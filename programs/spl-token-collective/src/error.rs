use anchor_lang::{prelude::*, solana_program::system_program};

#[error]
pub enum ErrorCode {
    #[msg("Provided account does not have an authority")]
    NoAuthority,

    #[msg("The bump provided did not match the canonical bump")]
    InvalidBump,

    #[msg("Invalid authority passed")]
    InvalidAuthority,

    #[msg("Bonding curve had invalid settings to join this collective")]
    InvalidTokenBondingSettings,

    #[msg("Bonding curve had invalid royalties accounts to join this collective")]
    InvalidTokenBondingRoyalties,

    #[msg("Unclaimed token had invalid metadata settings to join this collective")]
    InvalidTokenMetadataSettings,

    #[msg("Incorrect owner on account")]
    IncorrectOwner
}