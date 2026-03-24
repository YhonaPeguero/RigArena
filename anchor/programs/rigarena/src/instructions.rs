use anchor_lang::prelude::*;

const MAX_PROMPT_LEN: usize = 280;
const MAX_PROOF_NAME_LEN: usize = 96;
const MAX_PROOF_DESC_LEN: usize = 200;
const INITIAL_VAULT_BALANCE: u64 = 1_000_000;

pub fn initialize_arena_handler(ctx: Context<InitializeArena>, prompt: String) -> Result<()> {
    require!(
        !prompt.trim().is_empty() && prompt.len() <= MAX_PROMPT_LEN,
        ArenaError::PromptTooLong
    );

    let now = Clock::get()?.unix_timestamp;

    let session = &mut ctx.accounts.session;
    session.authority = ctx.accounts.authority.key();
    session.prompt = prompt;
    session.status = ArenaStatus::Active;
    session.total_paid = 0;
    session.winner = None;
    session.minted = false;
    session.payment_in_progress = false;
    session.last_payment_at = now;
    session.payment_count = 0;
    session.bump = ctx.bumps.session;

    seed_vault(
        &mut ctx.accounts.tutor_vault,
        AgentRole::Tutor,
        ctx.bumps.tutor_vault,
        now,
    );
    seed_vault(
        &mut ctx.accounts.coder_vault,
        AgentRole::Coder,
        ctx.bumps.coder_vault,
        now,
    );
    seed_vault(
        &mut ctx.accounts.tester_vault,
        AgentRole::Tester,
        ctx.bumps.tester_vault,
        now,
    );
    seed_vault(
        &mut ctx.accounts.deployer_vault,
        AgentRole::Deployer,
        ctx.bumps.deployer_vault,
        now,
    );

    assert_rent_exempt(&ctx.accounts.session.to_account_info())?;
    assert_rent_exempt(&ctx.accounts.tutor_vault.to_account_info())?;
    assert_rent_exempt(&ctx.accounts.coder_vault.to_account_info())?;
    assert_rent_exempt(&ctx.accounts.tester_vault.to_account_info())?;
    assert_rent_exempt(&ctx.accounts.deployer_vault.to_account_info())?;

    Ok(())
}

pub fn pay_agent_handler(
    ctx: Context<PayAgent>,
    from: AgentRole,
    to: AgentRole,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, ArenaError::InvalidAmount);
    require!(from != to, ArenaError::InvalidAgent);
    require!(
        ctx.accounts.session.status == ArenaStatus::Active,
        ArenaError::ArenaNotActive
    );
    require!(
        !ctx.accounts.session.payment_in_progress,
        ArenaError::ReentrancyDetected
    );

    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.session.payment_in_progress = true;

    match (from, to) {
        (AgentRole::Tutor, AgentRole::Coder) => transfer_between(
            &mut ctx.accounts.tutor_vault,
            &mut ctx.accounts.coder_vault,
            amount,
            AgentRole::Tutor,
            AgentRole::Coder,
            now,
        )?,
        (AgentRole::Tutor, AgentRole::Tester) => transfer_between(
            &mut ctx.accounts.tutor_vault,
            &mut ctx.accounts.tester_vault,
            amount,
            AgentRole::Tutor,
            AgentRole::Tester,
            now,
        )?,
        (AgentRole::Tutor, AgentRole::Deployer) => transfer_between(
            &mut ctx.accounts.tutor_vault,
            &mut ctx.accounts.deployer_vault,
            amount,
            AgentRole::Tutor,
            AgentRole::Deployer,
            now,
        )?,
        (AgentRole::Coder, AgentRole::Tutor) => transfer_between(
            &mut ctx.accounts.coder_vault,
            &mut ctx.accounts.tutor_vault,
            amount,
            AgentRole::Coder,
            AgentRole::Tutor,
            now,
        )?,
        (AgentRole::Coder, AgentRole::Tester) => transfer_between(
            &mut ctx.accounts.coder_vault,
            &mut ctx.accounts.tester_vault,
            amount,
            AgentRole::Coder,
            AgentRole::Tester,
            now,
        )?,
        (AgentRole::Coder, AgentRole::Deployer) => transfer_between(
            &mut ctx.accounts.coder_vault,
            &mut ctx.accounts.deployer_vault,
            amount,
            AgentRole::Coder,
            AgentRole::Deployer,
            now,
        )?,
        (AgentRole::Tester, AgentRole::Tutor) => transfer_between(
            &mut ctx.accounts.tester_vault,
            &mut ctx.accounts.tutor_vault,
            amount,
            AgentRole::Tester,
            AgentRole::Tutor,
            now,
        )?,
        (AgentRole::Tester, AgentRole::Coder) => transfer_between(
            &mut ctx.accounts.tester_vault,
            &mut ctx.accounts.coder_vault,
            amount,
            AgentRole::Tester,
            AgentRole::Coder,
            now,
        )?,
        (AgentRole::Tester, AgentRole::Deployer) => transfer_between(
            &mut ctx.accounts.tester_vault,
            &mut ctx.accounts.deployer_vault,
            amount,
            AgentRole::Tester,
            AgentRole::Deployer,
            now,
        )?,
        (AgentRole::Deployer, AgentRole::Tutor) => transfer_between(
            &mut ctx.accounts.deployer_vault,
            &mut ctx.accounts.tutor_vault,
            amount,
            AgentRole::Deployer,
            AgentRole::Tutor,
            now,
        )?,
        (AgentRole::Deployer, AgentRole::Coder) => transfer_between(
            &mut ctx.accounts.deployer_vault,
            &mut ctx.accounts.coder_vault,
            amount,
            AgentRole::Deployer,
            AgentRole::Coder,
            now,
        )?,
        (AgentRole::Deployer, AgentRole::Tester) => transfer_between(
            &mut ctx.accounts.deployer_vault,
            &mut ctx.accounts.tester_vault,
            amount,
            AgentRole::Deployer,
            AgentRole::Tester,
            now,
        )?,
        _ => return err!(ArenaError::InvalidAgent),
    }

    let session = &mut ctx.accounts.session;
    session.total_paid = session
        .total_paid
        .checked_add(amount)
        .ok_or(ArenaError::MathOverflow)?;
    session.payment_count = session
        .payment_count
        .checked_add(1)
        .ok_or(ArenaError::MathOverflow)?;
    session.last_payment_at = now;
    session.payment_in_progress = false;

    assert_rent_exempt(&ctx.accounts.session.to_account_info())?;
    assert_rent_exempt(&ctx.accounts.tutor_vault.to_account_info())?;
    assert_rent_exempt(&ctx.accounts.coder_vault.to_account_info())?;
    assert_rent_exempt(&ctx.accounts.tester_vault.to_account_info())?;
    assert_rent_exempt(&ctx.accounts.deployer_vault.to_account_info())?;

    emit!(ArenaPayment {
        from,
        to,
        amount,
        timestamp: now,
    });

    Ok(())
}

pub fn mint_proof_handler(ctx: Context<MintProof>, winner: AgentRole) -> Result<()> {
    require!(
        ctx.accounts.session.status == ArenaStatus::Active,
        ArenaError::ArenaNotActive
    );
    require!(!ctx.accounts.session.minted, ArenaError::AlreadyMinted);

    let now = Clock::get()?.unix_timestamp;
    let session_key = ctx.accounts.session.key();
    let mint = Pubkey::find_program_address(
        &[b"proof-mint", session_key.as_ref()],
        &crate::ID,
    )
    .0;

    let name = build_proof_name(&ctx.accounts.session.prompt);
    let description = build_proof_description(&ctx.accounts.session.prompt);

    let session = &mut ctx.accounts.session;
    session.status = ArenaStatus::Complete;
    session.winner = Some(winner);
    session.minted = true;
    session.payment_in_progress = false;

    let proof_nft = &mut ctx.accounts.proof_nft;
    proof_nft.session = session_key;
    proof_nft.winner = winner;
    proof_nft.mint = mint;
    proof_nft.name = name;
    proof_nft.description = description;
    proof_nft.soulbound = true;
    proof_nft.minted_at = now;
    proof_nft.bump = ctx.bumps.proof_nft;

    assert_rent_exempt(&ctx.accounts.session.to_account_info())?;
    assert_rent_exempt(&ctx.accounts.proof_nft.to_account_info())?;

    emit!(ProofMinted {
        session: session_key,
        winner,
        mint,
    });

    Ok(())
}

fn seed_vault(vault: &mut Account<AgentVault>, role: AgentRole, bump: u8, now: i64) {
    vault.role = role;
    vault.balance_micro_usdc = INITIAL_VAULT_BALANCE;
    vault.last_updated = now;
    vault.bump = bump;
    vault.is_initialized = true;
}

fn transfer_between<'info>(
    from_vault: &mut Account<'info, AgentVault>,
    to_vault: &mut Account<'info, AgentVault>,
    amount: u64,
    expected_from: AgentRole,
    expected_to: AgentRole,
    now: i64,
) -> Result<()> {
    require!(
        from_vault.is_initialized && to_vault.is_initialized,
        ArenaError::InvalidAgent
    );
    require!(from_vault.role == expected_from, ArenaError::InvalidAgent);
    require!(to_vault.role == expected_to, ArenaError::InvalidAgent);
    require!(
        from_vault.balance_micro_usdc >= amount,
        ArenaError::InsufficientVaultBalance
    );

    from_vault.balance_micro_usdc = from_vault
        .balance_micro_usdc
        .checked_sub(amount)
        .ok_or(ArenaError::MathOverflow)?;
    to_vault.balance_micro_usdc = to_vault
        .balance_micro_usdc
        .checked_add(amount)
        .ok_or(ArenaError::MathOverflow)?;
    from_vault.last_updated = now;
    to_vault.last_updated = now;

    Ok(())
}

fn assert_rent_exempt(account: &AccountInfo<'_>) -> Result<()> {
    let rent = Rent::get()?;
    require!(
        account.lamports() >= rent.minimum_balance(account.data_len()),
        ArenaError::NotRentExempt
    );
    Ok(())
}

fn build_proof_name(prompt: &str) -> String {
    let preview = truncate_chars(prompt, 36);
    format!("Proof of Build -- {}", preview)
}

fn build_proof_description(prompt: &str) -> String {
    let preview = truncate_chars(prompt, 84);
    truncate_chars(
        &format!(
            "Soulbound proof minted by RigArena after the winning agent completed the Solana learning run for: {}",
            preview
        ),
        MAX_PROOF_DESC_LEN,
    )
}

fn truncate_chars(value: &str, max_len: usize) -> String {
    value.chars().take(max_len).collect()
}

#[derive(Accounts)]
#[instruction(prompt: String)]
pub struct InitializeArena<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init_if_needed,
        payer = authority,
        space = ArenaSession::SPACE,
        seeds = [b"arena", authority.key().as_ref()],
        bump,
    )]
    pub session: Account<'info, ArenaSession>,

    #[account(
        init_if_needed,
        payer = authority,
        space = AgentVault::SPACE,
        seeds = [b"vault", b"tutor"],
        bump,
    )]
    pub tutor_vault: Account<'info, AgentVault>,

    #[account(
        init_if_needed,
        payer = authority,
        space = AgentVault::SPACE,
        seeds = [b"vault", b"coder"],
        bump,
    )]
    pub coder_vault: Account<'info, AgentVault>,

    #[account(
        init_if_needed,
        payer = authority,
        space = AgentVault::SPACE,
        seeds = [b"vault", b"tester"],
        bump,
    )]
    pub tester_vault: Account<'info, AgentVault>,

    #[account(
        init_if_needed,
        payer = authority,
        space = AgentVault::SPACE,
        seeds = [b"vault", b"deployer"],
        bump,
    )]
    pub deployer_vault: Account<'info, AgentVault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayAgent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"arena", authority.key().as_ref()],
        bump = session.bump,
        has_one = authority,
    )]
    pub session: Account<'info, ArenaSession>,

    #[account(
        mut,
        seeds = [b"vault", b"tutor"],
        bump = tutor_vault.bump,
    )]
    pub tutor_vault: Account<'info, AgentVault>,

    #[account(
        mut,
        seeds = [b"vault", b"coder"],
        bump = coder_vault.bump,
    )]
    pub coder_vault: Account<'info, AgentVault>,

    #[account(
        mut,
        seeds = [b"vault", b"tester"],
        bump = tester_vault.bump,
    )]
    pub tester_vault: Account<'info, AgentVault>,

    #[account(
        mut,
        seeds = [b"vault", b"deployer"],
        bump = deployer_vault.bump,
    )]
    pub deployer_vault: Account<'info, AgentVault>,
}

#[derive(Accounts)]
pub struct MintProof<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"arena", authority.key().as_ref()],
        bump = session.bump,
        has_one = authority,
    )]
    pub session: Account<'info, ArenaSession>,

    #[account(
        init_if_needed,
        payer = authority,
        space = ProofNft::SPACE,
        seeds = [b"proof", session.key().as_ref()],
        bump,
    )]
    pub proof_nft: Account<'info, ProofNft>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct ArenaSession {
    pub authority: Pubkey,
    pub prompt: String,
    pub status: ArenaStatus,
    pub total_paid: u64,
    pub winner: Option<AgentRole>,
    pub minted: bool,
    pub payment_in_progress: bool,
    pub last_payment_at: i64,
    pub payment_count: u32,
    pub bump: u8,
}

impl ArenaSession {
    pub const SPACE: usize = 8 + 32 + 4 + MAX_PROMPT_LEN + 1 + 8 + 2 + 1 + 1 + 8 + 4 + 1;
}

#[account]
pub struct AgentVault {
    pub role: AgentRole,
    pub balance_micro_usdc: u64,
    pub last_updated: i64,
    pub bump: u8,
    pub is_initialized: bool,
}

impl AgentVault {
    pub const SPACE: usize = 8 + 1 + 8 + 8 + 1 + 1;
}

#[account]
pub struct ProofNft {
    pub session: Pubkey,
    pub winner: AgentRole,
    pub mint: Pubkey,
    pub name: String,
    pub description: String,
    pub soulbound: bool,
    pub minted_at: i64,
    pub bump: u8,
}

impl ProofNft {
    pub const SPACE: usize =
        8 + 32 + 1 + 32 + 4 + MAX_PROOF_NAME_LEN + 4 + MAX_PROOF_DESC_LEN + 1 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AgentRole {
    Tutor,
    Coder,
    Tester,
    Deployer,
}

impl AgentRole {
    pub const fn seed_bytes(&self) -> &'static [u8] {
        match self {
            AgentRole::Tutor => b"tutor",
            AgentRole::Coder => b"coder",
            AgentRole::Tester => b"tester",
            AgentRole::Deployer => b"deployer",
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ArenaStatus {
    Active,
    Complete,
}

#[event]
pub struct ArenaPayment {
    pub from: AgentRole,
    pub to: AgentRole,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProofMinted {
    pub session: Pubkey,
    pub winner: AgentRole,
    pub mint: Pubkey,
}

#[error_code]
pub enum ArenaError {
    #[msg("Arena session is not active")]
    ArenaNotActive,

    #[msg("Badge is not pending")]
    BadgeNotPending,

    #[msg("Invalid agent role or vault mapping")]
    InvalidAgent,

    #[msg("Proof NFT already minted for this session")]
    AlreadyMinted,

    #[msg("Prompt must be non-empty and within the configured limit")]
    PromptTooLong,

    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    #[msg("The account is not rent exempt")]
    NotRentExempt,

    #[msg("Reentrancy detected while processing a payment")]
    ReentrancyDetected,

    #[msg("Agent vault does not have enough balance")]
    InsufficientVaultBalance,

    #[msg("Math overflow detected")]
    MathOverflow,
}
