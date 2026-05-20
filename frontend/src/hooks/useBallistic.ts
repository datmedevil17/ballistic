import { useCallback, useEffect, useRef, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor'
import {
  type Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { Ballistic } from '../idl/ballistic'
import IDL from '../idl/ballistic.json'
import { dispatchTxToast } from '../components/TxToast'

const PROGRAM_ID = new PublicKey('FeM2fDoHX1wTppwwxSsg1xkXzAwei9WCk3C6tsgozobB')
const ER_ENDPOINT = 'https://devnet.magicblock.app'
const NOOP_PROGRAM = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV')
const MIN_LAMPORTS = 0.05 * LAMPORTS_PER_SOL

// Adds a random noop instruction so each tx has a unique signature even with
// identical instruction data (e.g. multiple record_solo_kill in a row).
function noopIx(): TransactionInstruction {
  return new TransactionInstruction({
    programId: NOOP_PROGRAM,
    keys: [],
    data: Buffer.from(crypto.getRandomValues(new Uint8Array(4))),
  })
}

export function useBallistic() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()

  const erConn    = useRef<Connection | null>(null)
  const tempKp    = useRef<Keypair | null>(null)
  const progRef   = useRef<Program<Ballistic> | null>(null)
  const [playerKey, setPlayerKey] = useState<PublicKey | null>(null)
  const [progReady, setProgReady] = useState(false)

  // One-time ER connection init
  useEffect(() => {
    if (!erConn.current) {
      erConn.current = new Connection(ER_ENDPOINT, { commitment: 'confirmed' })
    }
  }, [])

  // Derive temp keypair + build Program client when wallet connects.
  // Uses Program.fetchIdl() (same as the MagicBlock counter sample) so the
  // discriminators are guaranteed to match the deployed anchor-lang 1.0 program.
  // Falls back to the local IDL if the on-chain IDL account is missing.
  useEffect(() => {
    if (!publicKey) {
      tempKp.current = null
      progRef.current = null
      setPlayerKey(null)
      setProgReady(false)
      return
    }
    const kp = Keypair.fromSeed(publicKey.toBytes())
    tempKp.current = kp
    setPlayerKey(kp.publicKey)
    setProgReady(false)

    const wallet = {
      publicKey: kp.publicKey,
      signTransaction:     async <T extends Transaction>(tx: T) => tx,
      signAllTransactions: async <T extends Transaction>(txs: T[]) => txs,
    }
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })

    Program.fetchIdl(PROGRAM_ID, provider)
      .then(idl => {
        progRef.current = new Program<Ballistic>(
          (idl ?? IDL) as Ballistic,
          provider,
        )
        setProgReady(true)
      })
      .catch(() => {
        progRef.current = new Program<Ballistic>(IDL as Ballistic, provider)
        setProgReady(true)
      })
  }, [connection, publicKey])

  const getProgram = useCallback((): Program<Ballistic> | null => progRef.current, [])

  // Top-up temp keypair via devnet airdrop when it is running low.
  const ensureTempFunded = useCallback(async () => {
    const kp = tempKp.current
    if (!kp) return
    const info = await connection.getAccountInfo(kp.publicKey)
    if (!info || info.lamports < MIN_LAMPORTS) {
      await connection.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL).catch(() => {})
    }
  }, [connection])

  // ── low-level submit ────────────────────────────────────────────────────────
  // ephemeral=true  → send to ER (gasless, processed commitment by default)
  // ephemeral=false → send to base layer (confirmed by default)
  // label           → shown in the right-side toast on success
  const submitTx = useCallback(async (
    tx: Transaction,
    opts: { ephemeral?: boolean; commitment?: Commitment; label?: string } = {},
  ): Promise<string | null> => {
    const kp   = tempKp.current
    const er   = erConn.current
    if (!kp || !er) return null
    const conn = opts.ephemeral ? er : connection
    try {
      const { value: { blockhash, lastValidBlockHeight } } =
        await conn.getLatestBlockhashAndContext()
      tx.recentBlockhash = blockhash
      tx.feePayer = kp.publicKey
      tx.add(noopIx())
      tx.sign(kp)
      const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true })
      await conn.confirmTransaction(
        { blockhash, lastValidBlockHeight, signature: sig },
        opts.commitment ?? (opts.ephemeral ? 'processed' : 'confirmed'),
      )
      if (opts.label) dispatchTxToast({ label: opts.label, sig, ephemeral: !!opts.ephemeral })
      return sig
    } catch (err) {
      console.error('[ballistic] tx failed:', err)
      return null
    }
  }, [connection])

  // After delegating an account, ping the ER to trigger lazy account reload.
  const pingEr = useCallback(async (pda: PublicKey) => {
    if (!erConn.current) return
    await erConn.current.requestAirdrop(pda, 1).catch(() => {})
  }, [])

  // ── helpers to derive PDAs client-side (for ping after delegation) ──────────
  const sessionPda = useCallback((player: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from('session'), player.toBytes()], PROGRAM_ID)[0],
  [])

  const roomPda = useCallback((roomId: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('game_room'), new BN(roomId).toArrayLike(Buffer as any, 'le', 8)],
      PROGRAM_ID,
    )[0],
  [])

  // ── Solo game instructions ──────────────────────────────────────────────────

  // Creates the PlayerSession PDA on base layer. Call once before delegating.
  const startAiGame = useCallback(async (): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    await ensureTempFunded()
    const tx = await prog.methods.startAiGame()
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { label: 'START SESSION' })
  }, [getProgram, ensureTempFunded, submitTx])

  // Delegates the session PDA to the ER. Call immediately after startAiGame.
  const delegateSession = useCallback(async (): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.delegateSession()
      .accounts({ player: kp.publicKey }).transaction()
    const sig = await submitTx(tx, { label: 'DELEGATE SESSION' })
    if (sig) await pingEr(sessionPda(kp.publicKey))
    return sig
  }, [getProgram, submitTx, pingEr, sessionPda])

  // Records an AI kill on the ER — gasless, fire-and-forget.
  const recordSoloKill = useCallback(async (): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.recordSoloKill()
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { ephemeral: true, label: 'SOLO KILL' })
  }, [getProgram, submitTx])

  // Respawn on ER after dying to AI — commits a checkpoint to base layer.
  const soloRespawn = useCallback(async (): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.soloRespawn()
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { ephemeral: true, commitment: 'confirmed', label: 'SOLO RESPAWN' })
  }, [getProgram, submitTx])

  // Commits final kill state + undelegates. Call when player exits or dies.
  const endSession = useCallback(async (): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.endSession()
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { ephemeral: true, commitment: 'confirmed', label: 'END SESSION' })
  }, [getProgram, submitTx])

  // Credits session kills into PendingRewards on base layer. Call after endSession.
  const collectSessionRewards = useCallback(async (): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.collectSessionRewards()
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { label: 'COLLECT REWARDS' })
  }, [getProgram, submitTx])

  // ── Multiplayer instructions ────────────────────────────────────────────────

  // Initialises the GameRoom PDA on base layer with status = Lobby.
  const createRoom = useCallback(async (roomId: number): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    await ensureTempFunded()
    const tx = await prog.methods.createRoom(new BN(roomId))
      .accounts({ creator: kp.publicKey }).transaction()
    return submitTx(tx, { label: 'CREATE ROOM' })
  }, [getProgram, ensureTempFunded, submitTx])

  const joinRoom = useCallback(async (roomId: number): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.joinRoom(new BN(roomId))
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { label: 'JOIN ROOM' })
  }, [getProgram, submitTx])

  const leaveRoom = useCallback(async (roomId: number): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.leaveRoom(new BN(roomId))
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { label: 'LEAVE ROOM' })
  }, [getProgram, submitTx])

  // Locks the room and marks it Active. Creator only. Requires ≥2 players.
  const startGame = useCallback(async (roomId: number): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.startGame(new BN(roomId))
      .accounts({ creator: kp.publicKey }).transaction()
    return submitTx(tx, { label: 'START GAME' })
  }, [getProgram, submitTx])

  // Delegates the GameRoom PDA to the ER. Call after startGame.
  const delegateRoom = useCallback(async (roomId: number): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.delegateRoom(new BN(roomId))
      .accounts({ creator: kp.publicKey }).transaction()
    const sig = await submitTx(tx, { label: 'DELEGATE ROOM' })
    if (sig) await pingEr(roomPda(roomId))
    return sig
  }, [getProgram, submitTx, pingEr, roomPda])

  // Records a kill on the ER — gasless, fire-and-forget.
  const recordKill = useCallback(async (roomId: number, victim: PublicKey): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.recordKill(new BN(roomId), victim)
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { ephemeral: true, label: 'KILL' })
  }, [getProgram, submitTx])

  const respawn = useCallback(async (roomId: number): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.respawn(new BN(roomId))
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { ephemeral: true, commitment: 'confirmed', label: 'RESPAWN' })
  }, [getProgram, submitTx])

  // Last surviving player calls this on the ER to close the room.
  const endGame = useCallback(async (roomId: number): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.endGame(new BN(roomId))
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { ephemeral: true, commitment: 'confirmed', label: 'END GAME' })
  }, [getProgram, submitTx])

  // Credits this player's kills from the ended room into PendingRewards.
  const updateRewards = useCallback(async (roomId: number): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.updateRewards(new BN(roomId))
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { label: 'UPDATE REWARDS' })
  }, [getProgram, submitTx])

  // ── Token claim ─────────────────────────────────────────────────────────────

  // Mints BALLISTIC tokens for all unclaimed kills. Rate: 1 kill = 1 token.
  const claimRewards = useCallback(async (): Promise<string | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const tx = await prog.methods.claimRewards()
      .accounts({ player: kp.publicKey }).transaction()
    return submitTx(tx, { label: 'CLAIM TOKENS' })
  }, [getProgram, submitTx])

  // Fetches the on-chain PendingRewards account for the current player.
  const fetchPendingRewards = useCallback(async (): Promise<{
    unclaimedKills: number
    totalKillsEver: number
  } | null> => {
    const prog = getProgram(); const kp = tempKp.current
    if (!prog || !kp) return null
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('rewards'), kp.publicKey.toBytes()],
      PROGRAM_ID,
    )
    try {
      const data = await prog.account.pendingRewards.fetch(pda)
      return {
        unclaimedKills: Number(data.unclaimedKills),
        totalKillsEver: Number(data.totalKillsEver),
      }
    } catch {
      return null
    }
  }, [getProgram])

  return {
    playerKey,
    progReady,
    // Solo
    startAiGame,
    delegateSession,
    recordSoloKill,
    soloRespawn,
    endSession,
    collectSessionRewards,
    // Multiplayer
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    delegateRoom,
    recordKill,
    respawn,
    endGame,
    updateRewards,
    // Rewards
    claimRewards,
    fetchPendingRewards,
  }
}
