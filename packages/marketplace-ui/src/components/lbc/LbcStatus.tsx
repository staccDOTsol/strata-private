import React, { useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useTokenBonding, useCapInfo, useSolanaUnixTime } from "@strata-foundation/react";
import { Countdown } from "../Countdown";
import { Center, Text, useInterval } from "@chakra-ui/react";
export const LbcStatus = ({
  tokenBondingKey,
  goLiveDate: inputGoLiveDate,
  endDate: inputEndDate,
}: {
  tokenBondingKey?: PublicKey;
  goLiveDate?: Date;
  endDate?: Date;
}) => {
  const { info: tokenBonding } = useTokenBonding(tokenBondingKey);
  const goLiveDate = useMemo(() => {
    if (inputGoLiveDate) {
      return inputGoLiveDate;
    }

    if (tokenBonding) {
      const date = new Date(0);
      date.setUTCSeconds(tokenBonding.goLiveUnixTime.toNumber());
      return date;
    }
  }, [tokenBonding, inputGoLiveDate]);
  const [isLive, setIsLive] = useState(true);
  const unixTime = useSolanaUnixTime();
  const unixTimeDate = useMemo(() => {
    const date = new Date(0);
    date.setUTCSeconds(unixTime || (new Date().valueOf() / 1000));
    return date;
  }, [unixTime]);
  useEffect(() => {
    setIsLive(goLiveDate ? goLiveDate < unixTimeDate : true);
  }, [unixTime]);
  
  const endDate = useMemo(() => {
    if (inputEndDate) {
      return inputEndDate;
    }
    // You might want to fetch the end date from the token bonding info if available
  }, [inputEndDate, tokenBonding]);

  const [status, setStatus] = useState<'upcoming' | 'live' | 'finished'>('upcoming');
  
  useEffect(() => {
    if (goLiveDate && endDate && unixTimeDate) {
      if (unixTimeDate < goLiveDate) {
        setStatus('upcoming');
      } else if (unixTimeDate >= goLiveDate && unixTimeDate < endDate) {
        setStatus('live');
      } else {
        setStatus('finished');
      }
    }
  }, [goLiveDate, endDate, unixTimeDate]);

  const { numRemaining } = useCapInfo(tokenBondingKey);
  const isSoldOut = typeof numRemaining !== "undefined" && numRemaining <= 0;

  if (isSoldOut) {
    return (
      <Center rounded="lg" borderColor="primary.500" borderWidth="1px" padding={4}>
        <Text fontWeight={600} color="primary.500">
          SOLD OUT
        </Text>
      </Center>
    );
  } else if (status === 'upcoming' && goLiveDate) {
    return <Countdown date={goLiveDate} />;
  } else if (status === 'finished') {
    return (
      <Center rounded="lg" borderColor="primary.500" borderWidth="1px" padding={4}>
        <Text fontWeight={600} color="primary.500">
          FINISHED
        </Text>
      </Center>
    );
  } else {
    return null; // Or return some "Live" indicator if desired
  }
};
