import { Disclaimer } from "../../../../src/components/Disclaimer";
import { Lbc } from "../../../../src/components/lbc/Lbc";
import { MetadataMeta } from "../../../../src/components/MetadataMeta";
import { SITE_URL } from "../../../../src/constants";
import { mintMetadataServerSideProps } from "../../../../src/utils/tokenMetadataServerProps";
import {
  Box, Container, DarkMode, VStack
} from "@chakra-ui/react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePublicKey } from "@strata-foundation/react";
import {
  GetServerSideProps,
  InferGetServerSidePropsType,
  NextPage
} from "next";
import { useRouter } from "next/router";
import React, { useCallback } from "react";

export const getServerSideProps: GetServerSideProps = mintMetadataServerSideProps;

export const LbcDisplay: NextPage<InferGetServerSidePropsType<typeof getServerSideProps>> = ({
  name,
  description,
  image,
}) => {
  const router = useRouter();
  const { id } = router.query;
  const mintKey = usePublicKey(id as string);
  const { setVisible } = useWalletModal();

  const onConnectWallet = useCallback(() => setVisible(true), [setVisible]);


  return (
    <>
      <Box
        w="full"
        backgroundColor="black"
        height="100vh"
        overflow="auto"
        paddingBottom="200px"
      >
        <MetadataMeta
          title={`Strata LBC Token Offering | ${name}`}
          description={description}
          image={image}
          url={`${SITE_URL}/lbcs/token-offering/${id?.toString()}/`}
        />
        <VStack spacing={2} align="left">
          <Container mt="35px" justifyContent="stretch" maxW="600px">
            <Lbc id={mintKey} onConnectWallet={onConnectWallet} />
          </Container>
        </VStack>
      </Box>
    </>
  );
};

export const DarkModeDisplay: NextPage<InferGetServerSidePropsType<typeof getServerSideProps>> = (props) => (
  <DarkMode>
    <LbcDisplay {...props} />
  </DarkMode>
);

export default DarkModeDisplay;