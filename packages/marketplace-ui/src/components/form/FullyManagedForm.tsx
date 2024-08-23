import { NFT_STORAGE_API_KEY } from "../../constants";
import {
  Alert,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Stack,
  Image,
  Text,
  Switch,
  useRadioGroup,
  VStack,
  Flex,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { createMetadataAccountV3, DataV2, findMetadataPda } from "@metaplex-foundation/mpl-token-metadata";
import { NATIVE_MINT,AuthorityType } from "@solana/spl-token";
import { AnchorWallet, useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { MarketplaceSdk } from "@strata-foundation/marketplace-sdk";
import {
  useCollective,
  useProvider,
  usePublicKey,
  useTokenMetadata,
} from "@strata-foundation/react";
import {
  ICurveConfig,
  SplTokenBonding,
  TimeCurveConfig,
  TimeDecayExponentialCurveConfig,
} from "@strata-foundation/spl-token-bonding";
import {
  ITokenBondingSettings,
  SplTokenCollective,
} from "@strata-foundation/spl-token-collective";
import { useRouter } from "next/router";
import React from "react";
import { useAsync, useAsyncCallback } from "react-async-hook";
import { FormProvider, useForm } from "react-hook-form";
import * as yup from "yup";
import { useMarketplaceSdk } from "../..//contexts/marketplaceSdkContext";
import { route, routes } from "../../utils/routes";
import { FormControlWithError } from "./FormControlWithError";
import { MintSelect } from "./MintSelect";
import { IMetadataFormProps, TokenMetadataInputs } from "./TokenMetadataInputs";
import { Disclosures, disclosuresSchema, IDisclosures } from "./Disclosures";
import { RadioCardWithAffordance } from "./RadioCard";
import { RoyaltiesInputs } from "./RoyaltiesInputs";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { publicKey, Umi } from "@metaplex-foundation/umi";
import { useUmi } from "../../providers/useUmi";
import { createMintInstructions } from "@strata-foundation/spl-utils";
import { AnchorProvider, Wallet } from "anchor-17";
import { setAuthority } from "@metaplex-foundation/mpl-toolbox";

type CurveType = "aggressive" | "stable" | "utility";
interface IFullyManagedForm extends IMetadataFormProps {
  mint: string;
  symbol: string;
  curveType: CurveType;
  isSocial: boolean;
  startingPrice: number;
  isAntiBot: boolean;
  sellBaseRoyaltyPercentage: number;
  buyBaseRoyaltyPercentage: number;
  sellTargetRoyaltyPercentage: number;
  buyTargetRoyaltyPercentage: number;
  disclosures: IDisclosures;
}

const validationSchema = yup.object({
  mint: yup.string().required(),
  image: yup.mixed().required(),
  name: yup.string().required().min(2),
  description: yup.string().required().min(2),
  symbol: yup.string().required().min(2),
  startingPrice: yup.number().required().min(0),
  isAntiBot: yup.boolean(),
  isSocial: yup.boolean(),
  sellBaseRoyaltyPercentage: yup.number().required(),
  buyBaseRoyaltyPercentage: yup.number().required(),
  sellTargetRoyaltyPercentage: yup.number().required(),
  buyTargetRoyaltyPercentage: yup.number().required(),
  disclosures: disclosuresSchema,
});

async function createFullyManaged(
  marketplaceSdk: MarketplaceSdk,
  values: IFullyManagedForm,
  umi: Umi,
  wallet: AnchorWallet, 
  provider: AnchorProvider
): Promise<PublicKey> {
  const mint = new PublicKey(values.mint);
  const tokenCollectiveSdk = marketplaceSdk.tokenCollectiveSdk;
  const tokenBondingSdk = tokenCollectiveSdk.splTokenBondingProgram;
  const targetMintKeypair = Keypair.generate();
  let k = 0;
  switch (values.curveType) {
    case "utility":
      k = 0.5;
      break;
    case "stable":
      k = 1;
      break;
    case "aggressive":
      k = 6;
      break;
  }

  const c = values.startingPrice * (k + 1);
  let config: ICurveConfig = new TimeDecayExponentialCurveConfig({
    c,
    k0: k,
    k1: k,
    d: 1,
    interval: 2 * 60 * 60, // 2 hours
  });
  if (values.isAntiBot) {
    config = new TimeCurveConfig()
      .addCurve(
        0,
        new TimeDecayExponentialCurveConfig({
          c,
          k0: 0,
          k1: 0,
          d: 1,
          interval: 0,
        })
      )
      .addCurve(
        30 * 60, // 30 minutes
        new TimeDecayExponentialCurveConfig({
          c,
          k0: 0,
          k1: k,
          d: 0.5,
          interval: 1.5 * 60 * 60, // 1.5 hours
        })
      );
  }
  const curveOut = await tokenBondingSdk.initializeCurveInstructions({
    config,
  });
  const initMintIx = await createMintInstructions(provider, wallet.publicKey, targetMintKeypair.publicKey, 9);
  const bondingOpts = {
    targetMint: targetMintKeypair.publicKey,
    baseMint: mint,
    buyBaseRoyaltyPercentage: values.buyBaseRoyaltyPercentage,
    buyTargetRoyaltyPercentage: values.buyTargetRoyaltyPercentage,
    sellBaseRoyaltyPercentage: values.sellBaseRoyaltyPercentage,
    sellTargetRoyaltyPercentage: values.sellTargetRoyaltyPercentage,
    curve: curveOut.output.curve,
    targetMintDecimals: 9,
  };
  const uri = await tokenCollectiveSdk.splTokenMetadata.uploadMetadata({
    name: values.name,
    symbol: values.symbol,
    description: values.description,
    image: values.image,
    mint: targetMintKeypair.publicKey,
  });
  const dataV2 = {
    name: values.name,
    symbol: values.symbol,
    uri,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  };

  const metadata = await findMetadataPda(umi, { mint: publicKey(targetMintKeypair.publicKey) });
const tx0 = new Transaction().add(...initMintIx)
await provider.sendAndConfirm(tx0, [targetMintKeypair])
  const tx = await createMetadataAccountV3(umi, {
    metadata,
    data: dataV2,
    mint: publicKey(targetMintKeypair.publicKey),
    payer: umi.payer,
    mintAuthority: umi.payer,
    updateAuthority: umi.payer,
    isMutable: true,
    collectionDetails: null
  }).
  buildAndSign(umi);
await umi.rpc.sendTransaction(tx)
let indexToUse = 0;
const getTokenBonding = () => {
  return SplTokenBonding.tokenBondingKey(targetMintKeypair.publicKey, indexToUse);
};
const getTokenBondingAccount = async () => {
  return provider.connection.getAccountInfo((await getTokenBonding())[0]);
};
while (await getTokenBondingAccount()) {
  indexToUse++;
}
const [bondingKey, bumpSeed] = await SplTokenBonding.tokenBondingKey(
  targetMintKeypair.publicKey,
  indexToUse
);
const tx2 = await setAuthority(umi, {
  owned: publicKey(targetMintKeypair.publicKey),
  owner: umi.payer,
  authorityType: 0  ,
  newAuthority: publicKey(bondingKey.toBase58())
}).buildAndSign(umi);
await umi.rpc.sendTransaction(tx2);


  if (values.isSocial) {
    const bondingOut = await tokenCollectiveSdk.createSocialTokenInstructions({
      mint,
      tokenBondingParams: bondingOpts,
      owner: tokenCollectiveSdk.wallet.publicKey,
      targetMintKeypair,
      metadata: undefined
    });
    await tokenCollectiveSdk.executeBig(
      Promise.resolve({
        output: null,
        instructions: [curveOut.instructions, ...bondingOut.instructions],
        signers: [curveOut.signers, ...bondingOut.signers],
      })
    );
  } else {

    const bondingOut = await tokenBondingSdk.createTokenBondingInstructions(
      bondingOpts
    );
    await tokenBondingSdk.executeBig(
      Promise.resolve({
        output: null,
        instructions: [
          [...curveOut.instructions],
          bondingOut.instructions
        ],
        signers: [
          [...curveOut.signers],
          bondingOut.signers
        ],
      })
    );
  }

  await umi.rpc.sendTransaction(tx);

  return targetMintKeypair.publicKey;
}

export const FullyManagedForm: React.FC = () => {
  const formProps = useForm<IFullyManagedForm>({
    // @ts-ignore
    resolver: yupResolver(validationSchema),
  });
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    watch,
  } = formProps;
  const { connected, publicKey } = useWallet();
  const { visible, setVisible } = useWalletModal();
  const { awaitingApproval } = useProvider();
  const { execute, loading, error } = useAsyncCallback(createFullyManaged);
  const { marketplaceSdk } = useMarketplaceSdk();
  const router = useRouter();
  const wallet = useAnchorWallet()
  const { connection } = useConnection()
  const provider = new AnchorProvider(connection, wallet, {})
const umi = useUmi()
  const onSubmit = async (values: IFullyManagedForm) => {
    const mintKey = await execute(marketplaceSdk!, values, umi, wallet, provider);
    router.push(
      route(routes.tokenAdmin, {
        mintKey: mintKey.toBase58(),
      }),
      undefined,
      { shallow: true }
    );
  };

  const { name = "", symbol = "", isSocial, mint, curveType } = watch();
  const mintKey = usePublicKey(mint);
  const { result: collectiveKey } = useAsync(
    async (mint: string | undefined) =>
      mint ? SplTokenCollective.collectiveKey(new PublicKey(mint)) : undefined,
    [mint]
  );
  const { info: collective } = useCollective(collectiveKey && collectiveKey[0]);
  const tokenBondingSettings = collective?.config
    .claimedTokenBondingSettings as unknown as ITokenBondingSettings | undefined;
  const {
    metadata: baseMetadata,
    error: baseMetadataError,
    loading: baseMetadataLoading,
  } = useTokenMetadata(mintKey);

  const { getRootProps, getRadioProps } = useRadioGroup({
    name: "curveType",
    onChange: (option) => setValue("curveType", option as CurveType),
  });

  const group = getRootProps();

  const curveOptions = [
    {
      value: "aggressive",
      heading: "Aggressive",
      illustration: "/aggressive.svg",
      helpText:
        "A curve with high price sensitivity. The price raises quickly when people buy, and lowers quickly when they sell. This is best suited for speculative use cases.",
    },
    {
      value: "stable",
      heading: "Stable",
      illustration: "/stable.svg",
      helpText:
        "A curve with medium price sensitivity. This curve changes price at a constant rate, achieving a balance between aggressive and utility curves.",
    },
    {
      value: "utility",
      heading: "Utility",
      illustration: "/utility.svg",
      helpText:
        "A curve with a price sensitivity that starts high and lowers with purchases. This curve is best suited for utility use cases, as it rewards early adopters and scales the supply so that the token can be exchanged for goods/services.",
    },
  ];

  return (
    <Flex position="relative">
      {!connected && (
        <Flex
          position="absolute"
          w="full"
          h="full"
          zIndex="1"
          flexDirection="column"
        >
          <Flex justifyContent="center">
            <Button
              colorScheme="orange"
              variant="outline"
              onClick={() => setVisible(!visible)}
            >
              Connect Wallet
            </Button>
          </Flex>
          <Flex w="full" h="full" bg="white" opacity="0.6" />
        </Flex>
      )}
      <FormProvider {...formProps}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <VStack spacing={8} mt={!connected ? 12 : 0}>
            <TokenMetadataInputs entityName="token" />
            <FormControlWithError
              id="symbol"
              help="The symbol for this token, ex: SOL"
              label="Symbol"
              errors={errors}
            >
              <Input {...register("symbol")} />
            </FormControlWithError>
            <FormControlWithError
              id="curveType"
              label="Price Sensitivity"
              errors={errors}
            >
              <Stack
                {...group}
                direction={{ base: "column", md: "row" }}
                justifyContent="center"
                alignItems={{ base: "center", md: "normal" }}
              >
                {curveOptions.map(
                  ({ value, heading, illustration, helpText }) => {
                    const radio = getRadioProps({ value });

                    return (
                      <RadioCardWithAffordance key={value} {...radio}>
                        <Flex
                          h="full"
                          direction={{ base: "row", md: "column" }}
                          textAlign={{ base: "left", md: "center" }}
                        >
                          <Flex
                            justifyContent="center"
                            alignItems="center"
                            flexShrink={0}
                          >
                            <Image
                              src={illustration}
                              alt={`${value}-illustration`}
                              height="70px"
                              width="100%"
                            />
                          </Flex>
                          <Flex
                            flexGrow={1}
                            h="full"
                            direction="column"
                            alignItems={{ base: "start", md: "center" }}
                            justifyContent={{ base: "center", md: "initial" }}
                          >
                            <Text
                              fontWeight="bold"
                              fontSize="md"
                              pt={{ base: 0, md: 4 }}
                            >
                              {heading}
                            </Text>
                            <Flex
                              w="full"
                              flexGrow={{ base: 0, md: 1 }}
                              alignItems={{ base: "start", md: "center" }}
                            >
                              <Text fontSize="xs" color="gray.500">
                                {helpText}
                              </Text>
                            </Flex>
                          </Flex>
                        </Flex>
                      </RadioCardWithAffordance>
                    );
                  }
                )}
              </Stack>
            </FormControlWithError>

            <FormControlWithError
              id="isSocial"
              help={`If this is a social token, it will be associated with your wallet. This means applications like Wum.bo will be able to discover this token by looking up your wallet, which may be associated with your twitter handle, .sol domain, or any other web3 applications. A social token can be part of a network of other social tokens: a collective.`}
              label="Social Token?"
              errors={errors}
            >
              <Switch {...register("isSocial")} />
            </FormControlWithError>
            <FormControlWithError
              id="mint"
              help={`The mint that should be used to purchase this token, example ${NATIVE_MINT.toBase58()} for SOL`}
              label="Mint"
              errors={errors}
            >
              <MintSelect
                value={watch("mint")}
                onChange={(s) => setValue("mint", s)}
              />{" "}
            </FormControlWithError>

            <FormControlWithError
              id="startingPrice"
              help="The starting price of the token. The price will increase as more tokens are purchased"
              label="Starting Price"
              errors={errors}
            >
              <Input
                type="number"
                min={0}
                step={0.0000000001}
                {...register("startingPrice")}
              />
            </FormControlWithError>
            <FormControlWithError
              id="isAntiBot"
              help={`Enable anti botting measures. This will keep bots from profiting by frontrunning your token while the price is low. Your tokens true pricing will take 2 hours to come into effect`}
              label="Enable Anti Bot Measures?"
              errors={errors}
            >
              <Switch {...register("isAntiBot")} />
            </FormControlWithError>
            
            <RoyaltiesInputs 
              symbol={symbol}
              baseSymbol={baseMetadata?.data.symbol}
              register={register}
              minBuyTargetRoyaltyPercentage={tokenBondingSettings?.minBuyTargetRoyaltyPercentage}
              maxBuyTargetRoyaltyPercentage={tokenBondingSettings?.maxBuyTargetRoyaltyPercentage}
              minSellTargetRoyaltyPercentage={tokenBondingSettings?.minSellTargetRoyaltyPercentage}
              maxSellTargetRoyaltyPercentage={tokenBondingSettings?.maxSellTargetRoyaltyPercentage}
              minBuyBaseRoyaltyPercentage={tokenBondingSettings?.minBuyBaseRoyaltyPercentage}
              maxBuyBaseRoyaltyPercentage={tokenBondingSettings?.maxBuyBaseRoyaltyPercentage}
              minSellBaseRoyaltyPercentage={tokenBondingSettings?.minSellBaseRoyaltyPercentage}
              maxSellBaseRoyaltyPercentage={tokenBondingSettings?.maxSellBaseRoyaltyPercentage}
            />

            <Disclosures fees={0} />

            {error && (
              <Alert status="error">
                <Alert status="error">{error.toString()}</Alert>
              </Alert>
            )}

            <Button
              type="submit"
              alignSelf="flex-end"
              colorScheme="primary"
              isLoading={isSubmitting || loading}
              loadingText={awaitingApproval ? "Awaiting Approval" : "Loading"}
            >
              Create Token
            </Button>
          </VStack>
        </form>
      </FormProvider>
    </Flex>
  );
};
