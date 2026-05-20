use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

declare_id!("FeM2fDoHX1wTppwwxSsg1xkXzAwei9WCk3C6tsgozobB");

pub const SESSION_SEED: &[u8] = b"session";
pub const GAME_ROOM_SEED: &[u8] = b"game_room";
pub const REWARDS_SEED: &[u8] = b"rewards";
pub const MINT_SEED: &[u8] = b"ballistic_mint";
pub const MINT_AUTH_SEED: &[u8] = b"mint_authority";

pub const LIVES_PER_PLAYER: u8 = 5;
pub const MAX_PLAYERS: usize = 10;
pub const SCORE_PER_KILL: u64 = 100;
pub const TOKEN_DECIMALS: u8 = 9;
pub const TOKENS_PER_KILL: u64 = 1_000_000_000; // 1 BALLISTIC per kill (9 decimals)

#[ephemeral]
#[program]
pub mod ballistic {
    use super::*;

    // ─────────────────────────────────────────────────────────────────────────
    // Token mint — one-time setup
    // ─────────────────────────────────────────────────────────────────────────

    /// Initialise the BALLISTIC SPL token mint.
    /// Mint authority is a program PDA — only claim_rewards can ever mint.
    pub fn initialize_mint(_ctx: Context<InitializeMint>) -> Result<()> {
        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SINGLE PLAYER — base layer setup
    // ─────────────────────────────────────────────────────────────────────────

    /// Creates the player's session PDA on base layer.
    /// Call delegate_session immediately after.
    pub fn start_ai_game(ctx: Context<StartAiGame>) -> Result<()> {
        let session = &mut ctx.accounts.player_session;
        // Always reset — init_if_needed keeps the existing account when the
        // player restarts after a previous session (avoids Custom 101 /
        // AccountAlreadyInUse from the System Program on re-init).
        session.player = ctx.accounts.player.key();
        session.kills = 0;
        session.score = 0;
        session.lives = LIVES_PER_PLAYER;
        session.alive = true;
        msg!("solo session started for {}", session.player);
        Ok(())
    }

    /// Delegates the player session PDA to the Ephemeral Rollup.
    /// After this all solo gameplay txs are gasless.
    pub fn delegate_session(ctx: Context<DelegateSession>) -> Result<()> {
        let session_data = PlayerSession::try_deserialize(
            &mut ctx.accounts.player_session.data.borrow().as_ref(),
        )?;
        require!(session_data.player == ctx.accounts.player.key(), BallisticError::NotCreator);

        ctx.accounts.delegate_player_session(
            &ctx.accounts.player,
            &[SESSION_SEED, ctx.accounts.player.key().as_ref()],
            DelegateConfig::default(),
        )?;
        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SINGLE PLAYER — gasless ER gameplay
    // ─────────────────────────────────────────────────────────────────────────

    /// Record an AI kill — gasless ER tx.
    /// Increments player's kill counter and score in the session PDA.
    pub fn record_solo_kill(ctx: Context<SoloAction>) -> Result<()> {
        let session = &mut ctx.accounts.player_session;
        require!(session.alive, BallisticError::CallerIsDead);

        session.kills += 1;
        session.score += SCORE_PER_KILL;

        msg!("solo kill: player={} total_kills={}", session.player, session.kills);
        Ok(())
    }

    /// Player respawns after dying to AI — gasless ER tx.
    /// Commits current kill state to base layer as a checkpoint, then marks alive.
    pub fn solo_respawn(ctx: Context<SoloCommit>) -> Result<()> {
        {
            let session = &mut ctx.accounts.player_session;
            require!(!session.alive, BallisticError::AlreadyAlive);
            require!(session.lives > 0, BallisticError::NoLivesRemaining);
            session.alive = true;
        } // mutable borrow dropped here

        // Checkpoint kills to base layer — PDA stays delegated for continued play.
        MagicIntentBundleBuilder::new(
            ctx.accounts.player.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.player_session.to_account_info()])
        .build_and_invoke()?;

        msg!("solo respawn: {} | lives_left={}", ctx.accounts.player_session.player, ctx.accounts.player_session.lives);
        Ok(())
    }

    /// Player exits to home screen — commits final kill state and undelegates.
    /// Call collect_session_rewards on base layer after this.
    pub fn end_session(ctx: Context<EndSession>) -> Result<()> {
        let (player_key, kills) = {
            let s = &ctx.accounts.player_session;
            (s.player, s.kills)
        }; // borrow dropped here

        MagicIntentBundleBuilder::new(
            ctx.accounts.player.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.player_session.to_account_info()])
        .build_and_invoke()?;

        msg!("solo session ended: {} kills={}", player_key, kills);
        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SINGLE PLAYER — base layer settlement
    // ─────────────────────────────────────────────────────────────────────────

    /// Credits kills from the ended session into the player's PendingRewards tally.
    /// Closes the session account (reclaims rent). Call after end_session commits.
    pub fn collect_session_rewards(ctx: Context<CollectSessionRewards>) -> Result<()> {
        let kills = ctx.accounts.player_session.kills;

        let rewards = &mut ctx.accounts.pending_rewards;
        rewards.player = ctx.accounts.player.key();
        rewards.unclaimed_kills += kills;
        rewards.total_kills_ever += kills;

        msg!(
            "session rewards collected: player={} kills={} unclaimed={}",
            ctx.accounts.player.key(),
            kills,
            rewards.unclaimed_kills
        );
        // session account is closed via `close = player` constraint — rent returned to player
        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MULTIPLAYER — base layer setup
    // ─────────────────────────────────────────────────────────────────────────

    /// Creator initialises the room on base layer. Status = Lobby.
    pub fn create_room(ctx: Context<CreateRoom>, room_id: u64) -> Result<()> {
        let room = &mut ctx.accounts.game_room;
        room.room_id = room_id;
        room.creator = ctx.accounts.creator.key();
        room.players = Vec::new();
        room.status = GameStatus::Lobby;
        room.created_at = Clock::get()?.unix_timestamp;
        msg!("room {} created by {}", room_id, room.creator);
        Ok(())
    }

    /// Any player joins the room while it is in Lobby.
    pub fn join_room(ctx: Context<ModifyRoom>, room_id: u64) -> Result<()> {
        let room = &mut ctx.accounts.game_room;
        require!(room.status == GameStatus::Lobby, BallisticError::GameAlreadyStarted);
        require!(room.players.len() < MAX_PLAYERS, BallisticError::RoomFull);

        let player_key = ctx.accounts.player.key();
        require!(
            !room.players.iter().any(|p| p.pubkey == player_key),
            BallisticError::AlreadyInRoom
        );

        room.players.push(PlayerEntry {
            pubkey: player_key,
            kills: 0,
            score: 0,
            lives: LIVES_PER_PLAYER,
            alive: true,
            rewards_credited: false,
        });
        msg!("player {} joined room {} ({}/{})", player_key, room_id, room.players.len(), MAX_PLAYERS);
        Ok(())
    }

    /// Player leaves the room while it is still in Lobby.
    pub fn leave_room(ctx: Context<ModifyRoom>, room_id: u64) -> Result<()> {
        let room = &mut ctx.accounts.game_room;
        require!(room.status == GameStatus::Lobby, BallisticError::GameAlreadyStarted);

        let player_key = ctx.accounts.player.key();
        let before = room.players.len();
        room.players.retain(|p| p.pubkey != player_key);
        require!(room.players.len() < before, BallisticError::PlayerNotFound);
        msg!("player {} left room {}", player_key, room_id);
        Ok(())
    }

    /// Creator locks the room and marks it Active. Requires at least 2 players.
    /// Call start_game then delegate_room back-to-back.
    pub fn start_game(ctx: Context<CreatorRoom>, _room_id: u64) -> Result<()> {
        let room = &mut ctx.accounts.game_room;
        require!(room.status == GameStatus::Lobby, BallisticError::GameAlreadyStarted);
        require!(room.players.len() >= 2, BallisticError::NotEnoughPlayers);
        room.status = GameStatus::Active;
        msg!("room started with {} players", room.players.len());
        Ok(())
    }

    /// Creator delegates the GameRoom PDA to the ER.
    /// Must be called after start_game. All subsequent gameplay is gasless.
    pub fn delegate_room(ctx: Context<DelegateRoom>, room_id: u64) -> Result<()> {
        let room_data = GameRoom::try_deserialize(
            &mut ctx.accounts.game_room.data.borrow().as_ref(),
        )?;
        require!(room_data.creator == ctx.accounts.creator.key(), BallisticError::NotCreator);
        require!(room_data.status == GameStatus::Active, BallisticError::GameNotStarted);

        ctx.accounts.delegate_game_room(
            &ctx.accounts.creator,
            &[GAME_ROOM_SEED, &room_id.to_le_bytes()],
            DelegateConfig::default(),
        )?;
        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MULTIPLAYER — gasless ER gameplay
    // ─────────────────────────────────────────────────────────────────────────

    /// Record a kill — gasless ER tx.
    /// Killer's counter increments. Victim loses one life and is marked dead.
    pub fn record_kill(ctx: Context<UpdateRoom>, _room_id: u64, victim: Pubkey) -> Result<()> {
        let room = &mut ctx.accounts.game_room;
        require!(room.status == GameStatus::Active, BallisticError::GameNotActive);

        let killer_key = ctx.accounts.player.key();
        require!(killer_key != victim, BallisticError::CannotKillSelf);

        let killer_idx = room
            .players
            .iter()
            .position(|p| p.pubkey == killer_key)
            .ok_or(BallisticError::PlayerNotFound)?;
        let victim_idx = room
            .players
            .iter()
            .position(|p| p.pubkey == victim)
            .ok_or(BallisticError::PlayerNotFound)?;

        require!(room.players[killer_idx].alive, BallisticError::CallerIsDead);
        require!(room.players[victim_idx].alive, BallisticError::VictimAlreadyDead);

        room.players[killer_idx].kills += 1;
        room.players[killer_idx].score += SCORE_PER_KILL;
        room.players[victim_idx].lives = room.players[victim_idx].lives.saturating_sub(1);
        room.players[victim_idx].alive = false;

        msg!(
            "kill: {} → {} | victim lives_left={}",
            killer_key,
            victim,
            room.players[victim_idx].lives
        );
        Ok(())
    }

    /// Player respawns after cooldown — gasless ER tx.
    /// Only allowed if the player still has lives remaining.
    pub fn respawn(ctx: Context<UpdateRoom>, _room_id: u64) -> Result<()> {
        let room = &mut ctx.accounts.game_room;
        require!(room.status == GameStatus::Active, BallisticError::GameNotActive);

        let player_key = ctx.accounts.player.key();

        let player = room
            .players
            .iter_mut()
            .find(|p| p.pubkey == player_key)
            .ok_or(BallisticError::PlayerNotFound)?;

        require!(!player.alive, BallisticError::AlreadyAlive);
        require!(player.lives > 0, BallisticError::NoLivesRemaining);

        player.alive = true;
        msg!("respawn: {} | lives_left={}", player_key, player.lives);
        Ok(())
    }

    /// Last surviving player calls this to end the game — gasless ER tx.
    /// Commits the final room state to base layer and undelegates.
    /// If all players exhaust lives simultaneously, any room member can close.
    pub fn end_game(ctx: Context<EndGame>, _room_id: u64) -> Result<()> {
        let room = &mut ctx.accounts.game_room;
        require!(room.status == GameStatus::Active, BallisticError::GameNotActive);

        let caller = ctx.accounts.player.key();
        let active_count = room.players.iter().filter(|p| p.lives > 0).count();
        require!(active_count <= 1, BallisticError::GameStillActive);

        if active_count == 1 {
            let winner = room.players.iter().find(|p| p.lives > 0).unwrap();
            require!(winner.pubkey == caller, BallisticError::NotTheWinner);
            msg!("game over — winner: {}", caller);
        } else {
            require!(
                room.players.iter().any(|p| p.pubkey == caller),
                BallisticError::PlayerNotFound
            );
            msg!("game over — no survivors");
        }

        room.status = GameStatus::Ended;
        room.exit(&crate::ID)?;

        MagicIntentBundleBuilder::new(
            ctx.accounts.player.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.game_room.to_account_info()])
        .build_and_invoke()?;

        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MULTIPLAYER — base layer settlement
    // ─────────────────────────────────────────────────────────────────────────

    /// Credits a player's kills from an ended room into their PendingRewards tally.
    /// Must be called on base layer after end_game has committed the room.
    /// Each player calls this once — double-credit is blocked by rewards_credited flag.
    pub fn update_rewards(ctx: Context<UpdateRewards>, room_id: u64) -> Result<()> {
        let room = &mut ctx.accounts.game_room;
        require!(room.status == GameStatus::Ended, BallisticError::GameNotEnded);

        let player_key = ctx.accounts.player.key();
        let player = room
            .players
            .iter_mut()
            .find(|p| p.pubkey == player_key)
            .ok_or(BallisticError::PlayerNotFound)?;

        require!(!player.rewards_credited, BallisticError::RewardsAlreadyCredited);

        let kills = player.kills;
        player.rewards_credited = true;

        let rewards = &mut ctx.accounts.pending_rewards;
        rewards.player = player_key;
        rewards.unclaimed_kills += kills;
        rewards.total_kills_ever += kills;

        msg!(
            "rewards updated: player={} room={} kills_credited={} unclaimed={}",
            player_key,
            room_id,
            kills,
            rewards.unclaimed_kills
        );
        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SHARED — profile token claim
    // ─────────────────────────────────────────────────────────────────────────

    /// Mint BALLISTIC tokens for all unclaimed kills and reset the tally.
    /// Rate: 1 kill = 1 BALLISTIC (9 decimals). Works for kills from any game mode.
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let rewards = &mut ctx.accounts.pending_rewards;
        let unclaimed = rewards.unclaimed_kills;
        require!(unclaimed > 0, BallisticError::NothingToClaim);

        let amount = unclaimed
            .checked_mul(TOKENS_PER_KILL)
            .ok_or(BallisticError::Overflow)?;

        rewards.unclaimed_kills = 0;

        let bump = ctx.bumps.mint_authority;
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.player_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                &[&[MINT_AUTH_SEED, &[bump]]],
            ),
            amount,
        )?;

        msg!(
            "claimed: player={} kills={} tokens={}",
            ctx.accounts.player.key(),
            unclaimed,
            amount
        );
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Account contexts — token
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    /// The BALLISTIC token mint — fixed program PDA, created once.
    #[account(
        init,
        payer = payer,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = mint_authority,
        seeds = [MINT_SEED],
        bump,
    )]
    pub mint: Account<'info, Mint>,
    /// CHECK: Program PDA that holds mint authority — only claim_rewards signs with it.
    #[account(seeds = [MINT_AUTH_SEED], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut, seeds = [MINT_SEED], bump)]
    pub mint: Account<'info, Mint>,
    /// CHECK: Mint authority PDA — signs the mint_to CPI.
    #[account(seeds = [MINT_AUTH_SEED], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [REWARDS_SEED, player.key().as_ref()],
        bump,
    )]
    pub pending_rewards: Account<'info, PendingRewards>,
    /// Player's BALLISTIC token account — created here if it does not exist.
    #[account(
        init_if_needed,
        payer = player,
        associated_token::mint = mint,
        associated_token::authority = player,
    )]
    pub player_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Account contexts — single player
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct StartAiGame<'info> {
    // `init_if_needed` — creates the account on first play; reuses it on
    // subsequent plays (fields are reset in the instruction body).
    // Without this, replaying causes Custom 101 (AccountAlreadyInUse).
    #[account(
        init_if_needed,
        payer = player,
        space = PlayerSession::SIZE,
        seeds = [SESSION_SEED, player.key().as_ref()],
        bump,
    )]
    pub player_session: Account<'info, PlayerSession>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// #[delegate] macro generates delegate_player_session() on this struct.
#[delegate]
#[derive(Accounts)]
pub struct DelegateSession<'info> {
    pub player: Signer<'info>,
    /// CHECK: Ownership verified in instruction body before delegation.
    #[account(mut, del, seeds = [SESSION_SEED, player.key().as_ref()], bump)]
    pub player_session: UncheckedAccount<'info>,
}

/// record_solo_kill — gasless ER tx.
#[derive(Accounts)]
pub struct SoloAction<'info> {
    #[account(mut, seeds = [SESSION_SEED, player.key().as_ref()], bump)]
    pub player_session: Account<'info, PlayerSession>,
    pub player: Signer<'info>,
}

/// solo_respawn — gasless ER tx with commit checkpoint.
/// #[commit] injects magic_context and magic_program.
#[commit]
#[derive(Accounts)]
pub struct SoloCommit<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut, seeds = [SESSION_SEED, player.key().as_ref()], bump)]
    pub player_session: Account<'info, PlayerSession>,
}

/// end_session — gasless ER tx, commit + undelegate.
/// #[commit] injects magic_context and magic_program.
#[commit]
#[derive(Accounts)]
pub struct EndSession<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut, seeds = [SESSION_SEED, player.key().as_ref()], bump)]
    pub player_session: Account<'info, PlayerSession>,
}

#[derive(Accounts)]
pub struct CollectSessionRewards<'info> {
    /// Session is closed after this call — rent returned to player.
    #[account(
        mut,
        close = player,
        seeds = [SESSION_SEED, player.key().as_ref()],
        bump,
    )]
    pub player_session: Account<'info, PlayerSession>,
    #[account(
        init_if_needed,
        payer = player,
        space = PendingRewards::SIZE,
        seeds = [REWARDS_SEED, player.key().as_ref()],
        bump,
    )]
    pub pending_rewards: Account<'info, PendingRewards>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Account contexts — multiplayer
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct CreateRoom<'info> {
    #[account(
        init,
        payer = creator,
        space = GameRoom::SIZE,
        seeds = [GAME_ROOM_SEED, &room_id.to_le_bytes()],
        bump,
    )]
    pub game_room: Account<'info, GameRoom>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct ModifyRoom<'info> {
    #[account(mut, seeds = [GAME_ROOM_SEED, &room_id.to_le_bytes()], bump)]
    pub game_room: Account<'info, GameRoom>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct CreatorRoom<'info> {
    #[account(
        mut,
        seeds = [GAME_ROOM_SEED, &room_id.to_le_bytes()],
        bump,
        has_one = creator @ BallisticError::NotCreator,
    )]
    pub game_room: Account<'info, GameRoom>,
    pub creator: Signer<'info>,
}

/// #[delegate] macro generates delegate_game_room() on this struct.
#[delegate]
#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct DelegateRoom<'info> {
    pub creator: Signer<'info>,
    /// CHECK: Creator and status verified in instruction body before delegation.
    #[account(mut, del, seeds = [GAME_ROOM_SEED, &room_id.to_le_bytes()], bump)]
    pub game_room: UncheckedAccount<'info>,
}

/// record_kill and respawn — gasless ER txs.
#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct UpdateRoom<'info> {
    #[account(mut, seeds = [GAME_ROOM_SEED, &room_id.to_le_bytes()], bump)]
    pub game_room: Account<'info, GameRoom>,
    pub player: Signer<'info>,
}

/// end_game — #[commit] injects magic_context and magic_program.
#[commit]
#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct EndGame<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut, seeds = [GAME_ROOM_SEED, &room_id.to_le_bytes()], bump)]
    pub game_room: Account<'info, GameRoom>,
}

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct UpdateRewards<'info> {
    /// The committed (Ended) game room — read to pull player kill count.
    #[account(mut, seeds = [GAME_ROOM_SEED, &room_id.to_le_bytes()], bump)]
    pub game_room: Account<'info, GameRoom>,
    /// Created on first update_rewards call by this player.
    #[account(
        init_if_needed,
        payer = player,
        space = PendingRewards::SIZE,
        seeds = [REWARDS_SEED, player.key().as_ref()],
        bump,
    )]
    pub pending_rewards: Account<'info, PendingRewards>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

/// Per-session solo game state. Lives on ER while game is active, committed on exit.
#[account]
pub struct PlayerSession {
    pub player: Pubkey,  // 32
    pub kills: u64,      // 8
    pub score: u64,      // 8
    pub lives: u8,       // 1
    pub alive: bool,     // 1
}

impl PlayerSession {
    pub const SIZE: usize = 8 + 32 + 8 + 8 + 1 + 1; // 58
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum GameStatus {
    Lobby,
    Active,
    Ended,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PlayerEntry {
    pub pubkey: Pubkey,          // 32
    pub kills: u64,              // 8
    pub score: u64,              // 8
    pub lives: u8,               // 1
    pub alive: bool,             // 1
    pub rewards_credited: bool,  // 1
}

impl PlayerEntry {
    pub const SIZE: usize = 32 + 8 + 8 + 1 + 1 + 1; // 51
}

#[account]
pub struct GameRoom {
    pub room_id: u64,              // 8
    pub creator: Pubkey,           // 32
    pub players: Vec<PlayerEntry>, // 4 + MAX_PLAYERS * 59
    pub status: GameStatus,        // 1
    pub created_at: i64,           // 8
}

impl GameRoom {
    pub const SIZE: usize = 8                              // discriminator
        + 8                                                // room_id
        + 32                                               // creator
        + 4 + MAX_PLAYERS * PlayerEntry::SIZE              // players vec
        + 1                                                // status
        + 8;                                               // created_at
}

/// Persistent profile kill accumulator — lives on base layer across all games.
/// Both solo (collect_session_rewards) and multiplayer (update_rewards) feed into this.
/// Call claim_rewards to mint tokens.
#[account]
pub struct PendingRewards {
    pub player: Pubkey,        // 32
    pub unclaimed_kills: u64,  // 8
    pub total_kills_ever: u64, // 8
}

impl PendingRewards {
    pub const SIZE: usize = 8 + 32 + 8 + 8; // 56
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum BallisticError {
    #[msg("Room is full (max 10 players)")]
    RoomFull,
    #[msg("Player is already in this room")]
    AlreadyInRoom,
    #[msg("Game has already started")]
    GameAlreadyStarted,
    #[msg("Game has not been started yet — call start_game first")]
    GameNotStarted,
    #[msg("Game is not active")]
    GameNotActive,
    #[msg("Game has not ended yet")]
    GameNotEnded,
    #[msg("Need at least 2 players to start")]
    NotEnoughPlayers,
    #[msg("Only the room creator can do this")]
    NotCreator,
    #[msg("Player not found in this room")]
    PlayerNotFound,
    #[msg("Cannot kill yourself")]
    CannotKillSelf,
    #[msg("Dead players cannot record kills")]
    CallerIsDead,
    #[msg("Victim is already dead")]
    VictimAlreadyDead,
    #[msg("Player is already alive")]
    AlreadyAlive,
    #[msg("No lives remaining — permanently out")]
    NoLivesRemaining,
    #[msg("Game still has active players")]
    GameStillActive,
    #[msg("Only the last surviving player can end the game")]
    NotTheWinner,
    #[msg("Rewards already credited for this game")]
    RewardsAlreadyCredited,
    #[msg("No kills to claim")]
    NothingToClaim,
    #[msg("Token amount overflow")]
    Overflow,
}
