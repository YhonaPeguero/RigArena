use anchor_lang::prelude::*;

pub mod instructions;

pub use instructions::*;

declare_id!("EQEWMBEtLZE7L2WS3iWo88rk8tQ4o8P9djmEJkG8gTFw");

#[program]
pub mod rigarena {
    use super::*;

    pub fn initialize_arena(ctx: Context<InitializeArena>, prompt: String) -> Result<()> {
        initialize_arena_handler(ctx, prompt)
    }

    pub fn pay_agent(
        ctx: Context<PayAgent>,
        from: AgentRole,
        to: AgentRole,
        amount: u64,
    ) -> Result<()> {
        pay_agent_handler(ctx, from, to, amount)
    }

    pub fn mint_proof(ctx: Context<MintProof>, winner: AgentRole) -> Result<()> {
        mint_proof_handler(ctx, winner)
    }
}
