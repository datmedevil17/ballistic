use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::access_control::instructions::{
    CommitAndUndelegatePermissionCpiBuilder, CreatePermissionCpiBuilder,
    DelegatePermissionCpiBuilder, UpdatePermissionCpiBuilder,
};
use ephemeral_rollups_sdk::access_control::structs::{Member, MembersArgs, PERMISSION_SEED};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::consts::PERMISSION_PROGRAM_ID;
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

declare_id!("HKzxdYAWje6tALFwBn1ccDau2yCYymp2N6xB6NpRx1gM");

pub const PLAYER_GAME_SEED: &[u8] = b"player_game";
pub const GAME_ROOM_SEED: &[u8] = b"game_room";
pub const MAX_PLAYERS: usize = 16;
pub const SCORE_PER_KILL: u64 = 100;

#[ephemeral]
#[program]
pub mod ballistic {
    use super::*;

    /// Create a game room on base layer. Holds the player registry and standings.
    pub fn create_room(ctx: Context<CreateRoom>, room_id: u64) -> Result<()> {
        let room = &mut ctx.accounts.game_room;
        room.room_id = room_id;
        room.players = Vec::new();
        room.active = true;
        room.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Initialize player game state and register in the room (base layer only).
    /// Call delegate_player next to move to ER.
    pub fn join_game(ctx: Context<JoinGame>, room_id: u64) -> Result<()> {
        let room = &mut ctx.accounts.game_room;
        require!(room.active, BallisticError::RoomNotActive);
        require!(room.players.len() < MAX_PLAYERS, BallisticError::RoomFull);
        require!(
            !room.players.contains(&ctx.accounts.payer.key()),
            BallisticError::AlreadyInRoom
        );

        let state = &mut ctx.accounts.player_game_state;
        state.player = ctx.accounts.payer.key();
        state.room_id = room_id;
        state.kills = 0;
        state.deaths = 0;
        state.score = 0;

        room.players.push(ctx.accounts.payer.key());
        Ok(())
    }

    /// Delegate the player's game state to the ER with private access control.
    /// members = wallets allowed to submit private ER txs for this account (at minimum, the player).
    pub fn delegate_player(
        ctx: Context<DelegatePlayerState>,
        members: Option<Vec<Member>>,
    ) -> Result<()> {
        let validator = ctx.accounts.validator.as_ref();
        let payer_key = ctx.accounts.payer.key();
        let bump = ctx.bumps.player_game_state;
        let signer_seeds: &[&[u8]] = &[PLAYER_GAME_SEED, payer_key.as_ref(), &[bump]];

        // 1. Create or update the permission (access-control) account.
        if ctx.accounts.permission.data_is_empty() {
            CreatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
                .permissioned_account(&ctx.accounts.player_game_state.to_account_info())
                .permission(&ctx.accounts.permission.to_account_info())
                .payer(&ctx.accounts.payer.to_account_info())
                .system_program(&ctx.accounts.system_program.to_account_info())
                .args(MembersArgs { members })
                .invoke_signed(&[signer_seeds])?;
        } else {
            UpdatePermissionCpiBuilder::new(&ctx.accounts.permission_program.to_account_info())
                .authority(&ctx.accounts.payer.to_account_info(), true)
                .permissioned_account(&ctx.accounts.player_game_state.to_account_info(), true)
                .permission(&ctx.accounts.permission.to_account_info())
                .args(MembersArgs { members })
                .invoke_signed(&[signer_seeds])?;
        }

        // 2. Delegate the permission account to the ER.
        if ctx.accounts.permission.owner != &ephemeral_rollups_sdk::id() {
            DelegatePermissionCpiBuilder::new(&ctx.accounts.permission_program.to_account_info())
                .permissioned_account(&ctx.accounts.player_game_state.to_account_info(), true)
                .permission(&ctx.accounts.permission.to_account_info())
                .payer(&ctx.accounts.payer.to_account_info())
                .authority(&ctx.accounts.player_game_state.to_account_info(), false)
                .system_program(&ctx.accounts.system_program.to_account_info())
                .owner_program(&ctx.accounts.permission_program.to_account_info())
                .delegation_buffer(&ctx.accounts.buffer_permission.to_account_info())
                .delegation_metadata(
                    &ctx.accounts.delegation_metadata_permission.to_account_info(),
                )
                .delegation_record(&ctx.accounts.delegation_record_permission.to_account_info())
                .delegation_program(&ctx.accounts.delegation_program.to_account_info())
                .validator(validator)
                .invoke_signed(&[signer_seeds])?;
        }

        // 3. Delegate the player game state account to the ER.
        if ctx.accounts.player_game_state.owner != &ephemeral_rollups_sdk::id() {
            ctx.accounts.delegate_player_game_state(
                &ctx.accounts.payer,
                &[PLAYER_GAME_SEED, payer_key.as_ref()],
                DelegateConfig {
                    validator: validator.map(|v| v.key()),
                    ..Default::default()
                },
            )?;
        }

        Ok(())
    }

    /// Record a kill — gasless ER tx. Private: only members of the permission list can call.
    pub fn record_kill(ctx: Context<UpdateState>) -> Result<()> {
        let state = &mut ctx.accounts.player_game_state;
        state.kills += 1;
        state.score += SCORE_PER_KILL;
        msg!(
            "kill player={} kills={} score={}",
            state.player,
            state.kills,
            state.score
        );
        Ok(())
    }

    /// Send an AI behavior prompt — private ER tx. Not stored on-chain, emitted as a log.
    /// The ER access control ensures only the player (or allowed members) can submit.
    pub fn send_prompt(ctx: Context<UpdateState>, data: String) -> Result<()> {
        msg!(
            "prompt player={} data={}",
            ctx.accounts.player_game_state.player,
            data
        );
        Ok(())
    }

    /// Commit state snapshot to base layer after death. Account stays delegated — player respawns.
    pub fn checkpoint(ctx: Context<CommitState>) -> Result<()> {
        let state = &mut ctx.accounts.player_game_state;
        state.deaths += 1;
        msg!(
            "checkpoint player={} kills={} deaths={} score={}",
            state.player,
            state.kills,
            state.deaths,
            state.score
        );
        // Serialize Anchor account before the commit CPI.
        state.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.player_game_state.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Commit final state and undelegate — player leaves game permanently.
    /// Final kills/score are written to base layer; GameRoom standings can be read from there.
    pub fn leave_game(ctx: Context<LeaveGame>) -> Result<()> {
        let state = &mut ctx.accounts.player_game_state;
        msg!(
            "leave player={} kills={} deaths={} score={}",
            state.player,
            state.kills,
            state.deaths,
            state.score
        );
        let payer_key = ctx.accounts.payer.key();
        let bump = ctx.bumps.player_game_state;
        // Serialize Anchor account before commit+undelegate CPIs.
        state.exit(&crate::ID)?;

        // 1. Commit and undelegate the permission account atomically.
        CommitAndUndelegatePermissionCpiBuilder::new(
            &ctx.accounts.permission_program.to_account_info(),
        )
        .authority(&ctx.accounts.payer.to_account_info(), true)
        .permissioned_account(&ctx.accounts.player_game_state.to_account_info(), true)
        .permission(&ctx.accounts.permission.to_account_info())
        .magic_context(&ctx.accounts.magic_context.to_account_info())
        .magic_program(&ctx.accounts.magic_program.to_account_info())
        .invoke_signed(&[&[PLAYER_GAME_SEED, payer_key.as_ref(), &[bump]]])?;

        // 2. Commit and undelegate the player game state account.
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.player_game_state.to_account_info()])
        .build_and_invoke()?;

        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Account contexts
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct CreateRoom<'info> {
    #[account(
        init,
        payer = payer,
        space = GameRoom::SIZE,
        seeds = [GAME_ROOM_SEED, &room_id.to_le_bytes()],
        bump,
    )]
    pub game_room: Account<'info, GameRoom>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct JoinGame<'info> {
    #[account(
        init,
        payer = payer,
        space = PlayerGameState::SIZE,
        seeds = [PLAYER_GAME_SEED, payer.key().as_ref()],
        bump,
    )]
    pub player_game_state: Account<'info, PlayerGameState>,
    #[account(
        mut,
        seeds = [GAME_ROOM_SEED, &room_id.to_le_bytes()],
        bump,
    )]
    pub game_room: Account<'info, GameRoom>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Add delegate function to the context via macro.
#[delegate]
#[derive(Accounts)]
pub struct DelegatePlayerState<'info> {
    pub payer: Signer<'info>,
    /// CHECK: The player game state PDA to delegate.
    #[account(mut, del, seeds = [PLAYER_GAME_SEED, payer.key().as_ref()], bump)]
    pub player_game_state: UncheckedAccount<'info>,
    /// CHECK: Permission account for the player PDA.
    #[account(mut, seeds = [PERMISSION_SEED, player_game_state.key().as_ref()], bump, seeds::program = permission_program.key())]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: Buffer for permission delegation.
    #[account(mut, seeds = [ephemeral_rollups_sdk::pda::DELEGATE_BUFFER_TAG, permission.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)]
    pub buffer_permission: UncheckedAccount<'info>,
    /// CHECK: Delegation record for permission.
    #[account(mut, seeds = [ephemeral_rollups_sdk::pda::DELEGATION_RECORD_TAG, permission.key().as_ref()], bump, seeds::program = ephemeral_rollups_sdk::id())]
    pub delegation_record_permission: UncheckedAccount<'info>,
    /// CHECK: Delegation metadata for permission.
    #[account(mut, seeds = [ephemeral_rollups_sdk::pda::DELEGATION_METADATA_TAG, permission.key().as_ref()], bump, seeds::program = ephemeral_rollups_sdk::id())]
    pub delegation_metadata_permission: UncheckedAccount<'info>,
    /// CHECK: Permission Program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: Validated by the delegate program.
    pub validator: Option<AccountInfo<'info>>,
}

/// Used for record_kill and send_prompt — gasless private ER txs.
/// Signer is the player; seeds tie the account to their pubkey.
#[derive(Accounts)]
pub struct UpdateState<'info> {
    #[account(mut, seeds = [PLAYER_GAME_SEED, player.key().as_ref()], bump)]
    pub player_game_state: Account<'info, PlayerGameState>,
    pub player: Signer<'info>,
}

/// #[commit] injects magic_context and magic_program accounts.
#[commit]
#[derive(Accounts)]
pub struct CommitState<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_GAME_SEED, payer.key().as_ref()], bump)]
    pub player_game_state: Account<'info, PlayerGameState>,
}

/// Same as CommitState but also carries the permission + permission program
/// so both can be atomically undelegated in a single ER transaction.
#[commit]
#[derive(Accounts)]
pub struct LeaveGame<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_GAME_SEED, payer.key().as_ref()], bump)]
    pub player_game_state: Account<'info, PlayerGameState>,
    /// CHECK: Checked by the permission program.
    #[account(mut, seeds = [PERMISSION_SEED, player_game_state.key().as_ref()], bump, seeds::program = permission_program.key())]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: Permission Program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

/// Lives on the ER while the player is in game. Committed to base layer on
/// checkpoint (death + respawn) or leave_game (permanent exit).
#[account]
pub struct PlayerGameState {
    pub player: Pubkey, // 32
    pub room_id: u64,   // 8
    pub kills: u64,     // 8
    pub deaths: u64,    // 8
    pub score: u64,     // 8
}

impl PlayerGameState {
    pub const SIZE: usize = 8 + 32 + 8 + 8 + 8 + 8; // discriminator + fields
}

/// Always on base layer. Tracks the player registry for a room.
/// Standings are derived by reading each player's committed PlayerGameState.
#[account]
pub struct GameRoom {
    pub room_id: u64,         // 8
    pub players: Vec<Pubkey>, // 4 + MAX_PLAYERS * 32
    pub active: bool,         // 1
    pub created_at: i64,      // 8
}

impl GameRoom {
    pub const SIZE: usize = 8 + 8 + (4 + MAX_PLAYERS * 32) + 1 + 8;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum BallisticError {
    #[msg("Game room is full (max 16 players)")]
    RoomFull,
    #[msg("Player is already in this room")]
    AlreadyInRoom,
    #[msg("Game room is not active")]
    RoomNotActive,
}
