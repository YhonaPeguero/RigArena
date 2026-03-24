import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Rigarena } from "../target/types/rigarena";

const ROLE = {
  tutor: { tutor: {} },
  coder: { coder: {} },
  tester: { tester: {} },
  deployer: { deployer: {} },
} as const;

describe("rigarena", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Rigarena as Program<Rigarena>;
  const authority = provider.wallet;

  const [sessionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("arena"), authority.publicKey.toBuffer()],
    program.programId
  );
  const [tutorVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Buffer.from("tutor")],
    program.programId
  );
  const [coderVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Buffer.from("coder")],
    program.programId
  );
  const [testerVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Buffer.from("tester")],
    program.programId
  );
  const [deployerVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Buffer.from("deployer")],
    program.programId
  );
  const [proofPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("proof"), sessionPda.toBuffer()],
    program.programId
  );

  async function initializeArena(prompt: string) {
    await program.methods
      .initializeArena(prompt)
      .accounts({
        authority: authority.publicKey,
        session: sessionPda,
        tutorVault: tutorVaultPda,
        coderVault: coderVaultPda,
        testerVault: testerVaultPda,
        deployerVault: deployerVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  it("inicializa arena correctamente", async () => {
    const prompt = "Teach PDAs and agent payments in Solana.";
    await initializeArena(prompt);

    const sessionAccount = await program.account.arenaSession.fetch(sessionPda);
    const tutorVault = await program.account.agentVault.fetch(tutorVaultPda);

    assert.equal(sessionAccount.prompt, prompt);
    assert.deepEqual(sessionAccount.status, { active: {} });
    assert.equal(sessionAccount.totalPaid.toNumber(), 0);
    assert.isNull(sessionAccount.winner);
    assert.isFalse(sessionAccount.minted);
    assert.deepEqual(tutorVault.role, ROLE.tutor);
    assert.equal(tutorVault.balanceMicroUsdc.toNumber(), 1_000_000);
  });

  it("registra pago entre agentes", async () => {
    await initializeArena("Register an agent payment.");

    const beforeTutor = await program.account.agentVault.fetch(tutorVaultPda);
    const beforeCoder = await program.account.agentVault.fetch(coderVaultPda);

    await program.methods
      .payAgent(ROLE.tutor, ROLE.coder, new anchor.BN(1_000))
      .accounts({
        authority: authority.publicKey,
        session: sessionPda,
        tutorVault: tutorVaultPda,
        coderVault: coderVaultPda,
        testerVault: testerVaultPda,
        deployerVault: deployerVaultPda,
      })
      .rpc();

    const sessionAccount = await program.account.arenaSession.fetch(sessionPda);
    const afterTutor = await program.account.agentVault.fetch(tutorVaultPda);
    const afterCoder = await program.account.agentVault.fetch(coderVaultPda);

    assert.equal(
      afterTutor.balanceMicroUsdc.toNumber(),
      beforeTutor.balanceMicroUsdc.toNumber() - 1_000
    );
    assert.equal(
      afterCoder.balanceMicroUsdc.toNumber(),
      beforeCoder.balanceMicroUsdc.toNumber() + 1_000
    );
    assert.equal(sessionAccount.totalPaid.toNumber(), 1_000);
    assert.equal(Number(sessionAccount.paymentCount), 1);
  });

  it("no permite pagar si arena no esta activa", async () => {
    await initializeArena("Close arena and reject new payments.");

    await program.methods
      .mintProof(ROLE.deployer)
      .accounts({
        authority: authority.publicKey,
        session: sessionPda,
        proofNft: proofPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    try {
      await program.methods
        .payAgent(ROLE.tutor, ROLE.coder, new anchor.BN(1_000))
        .accounts({
          authority: authority.publicKey,
          session: sessionPda,
          tutorVault: tutorVaultPda,
          coderVault: coderVaultPda,
          testerVault: testerVaultPda,
          deployerVault: deployerVaultPda,
        })
        .rpc();

      assert.fail("Expected ArenaNotActive error");
    } catch (error: any) {
      const anchorError = anchor.AnchorError.parse(error.logs);
      assert.isNotNull(anchorError);
      assert.equal(anchorError?.error.errorCode.code, "ArenaNotActive");
    }
  });

  it("mintea NFT soulbound al completar", async () => {
    await initializeArena("Mint the final proof.");

    await program.methods
      .mintProof(ROLE.deployer)
      .accounts({
        authority: authority.publicKey,
        session: sessionPda,
        proofNft: proofPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const sessionAccount = await program.account.arenaSession.fetch(sessionPda);
    const proofAccount = await program.account.proofNft.fetch(proofPda);

    assert.deepEqual(sessionAccount.status, { complete: {} });
    assert.deepEqual(sessionAccount.winner, ROLE.deployer);
    assert.isTrue(sessionAccount.minted);
    assert.equal(proofAccount.session.toBase58(), sessionPda.toBase58());
    assert.deepEqual(proofAccount.winner, ROLE.deployer);
    assert.isTrue(proofAccount.soulbound);
    assert.match(proofAccount.name, /^Proof of Build -- /);
  });
});
