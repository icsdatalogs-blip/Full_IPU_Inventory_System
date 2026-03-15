"use client";

import { Box, Heading, Text, VStack } from "@chakra-ui/react";

const WaveSvg = () => (
  <Box
    position="absolute"
    bottom={{ base: "78px", md: "70px" }}
    left={0}
    w="100%"
    h="170px"
    pointerEvents="none"
    zIndex={0}
    overflow="hidden"
  >
    <Box
      as="svg"
      position="absolute"
      inset={0}
      w="120%"
      left="-10%"
      h="100%"
      opacity={0.42}
      viewBox="0 0 1200 220"
      preserveAspectRatio="none"
    >
      <path
        d="M0,120 C70,10 140,210 210,120 C280,30 350,220 420,120 C490,10 560,210 630,120 C700,30 770,220 840,120 C910,10 980,210 1050,120 C1120,30 1160,180 1200,120"
        fill="none"
        stroke="rgba(243,112,33,0.6)"
        strokeWidth="22"
        strokeLinecap="round"
      />
      <path
        d="M0,105 C80,210 160,0 240,105 C320,210 400,0 480,105 C560,210 640,0 720,105 C800,210 880,0 960,105 C1040,210 1120,0 1200,105"
        fill="none"
        stroke="rgba(20,137,168,0.58)"
        strokeWidth="12"
        strokeLinecap="round"
      />
    </Box>
    <Box
      as="svg"
      position="absolute"
      inset={0}
      w="120%"
      left="-10%"
      h="100%"
      opacity={0.4}
      viewBox="0 0 1200 360"
      preserveAspectRatio="none"
    >
      <path
        d="M0,170 C120,300 240,40 360,160 C480,280 600,60 720,180 C840,300 960,40 1080,160 L1200,280 L1200,360 L0,360 Z"
        fill="rgba(20,137,168,0.1)"
      />
      <path
        d="M0,210 C150,340 300,90 450,200 C600,320 750,110 900,220 C1050,340 1120,250 1200,280 L1200,360 L0,360 Z"
        fill="rgba(243,112,33,0.08)"
      />
    </Box>
  </Box>
);

type AppHeaderProps = {
  title?: string;
  sub?: string;
  tagline?: string;
};

export function AppHeader({
  title = "OHI • Innovative Care Solutions",
  sub = "Inventory Portal",
  tagline,
}: AppHeaderProps) {
  return (
    <Box
      as="header"
      textAlign="center"
      pt={{ base: "56px", md: "70px" }}
      pb="30px"
      px={5}
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        left="50%"
        top="42px"
        transform="translateX(-50%)"
        w={{ base: "92vw", md: "min(760px, 92vw)" }}
        h="140px"
        bgGradient="radial(circle at 50% 45%, rgba(255,255,255,0.92), rgba(255,255,255,0.55) 55%, transparent 78%)"
        pointerEvents="none"
        zIndex={1}
      />
      <VStack position="relative" zIndex={2} spacing={1}>
        <Heading
          as="h1"
          size="md"
          fontWeight={760}
          letterSpacing="1px"
          color="rgba(15,23,42,0.9)"
        >
          {title}
        </Heading>
        <Text
          fontSize="xs"
          letterSpacing="1px"
          color="rgba(0,0,0,0.5)"
          textTransform="uppercase"
          fontWeight={700}
        >
          {sub}
        </Text>
        {tagline && (
          <Text fontSize="sm" color="rgba(0,0,0,0.5)" letterSpacing="0.5px">
            {tagline}
          </Text>
        )}
      </VStack>
      <WaveSvg />
    </Box>
  );
}
