"use client";

import Link from "next/link";
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Card,
  CardBody,
  HStack,
} from "@chakra-ui/react";
import { AppHeader } from "./components/AppHeader";

const IPUS = [
  { id: "1", name: "Dayton", slug: "dayton" },
  { id: "2", name: "Butler Warren", slug: "butler-warren" },
  { id: "3", name: "Miami County", slug: "miami-county" },
];

export default function HomePage() {
  return (
    <>
      <AppHeader
        sub="Inventory Portal"
        tagline="Select a unit to view par levels & scan tools"
      />
      <Box as="main" maxW="1020px" mx="auto" textAlign="center" px={3} pb={14}>
        <HStack justify="center" spacing={3} mb={2}>
          <Box
            w="34px"
            h="34px"
            borderRadius="12px"
            bgGradient="radial(circle at 30% 30%, rgba(243,112,33,0.45), transparent 62%), radial(circle at 70% 60%, rgba(20,137,168,0.38), transparent 64%)"
            bgColor="rgba(255,255,255,0.72)"
          />
          <Heading size="lg" fontWeight={560} color="rgba(15,23,42,0.72)">
            Select an IPU
          </Heading>
        </HStack>
        <Text fontSize="sm" color="rgba(0,0,0,0.5)" mb={14}>
          Choose your inpatient unit below
        </Text>

        <SimpleGrid
          columns={{ base: 1, sm: 2, md: 3 }}
          spacing={10}
          justifyItems="center"
          maxW="900px"
          mx="auto"
        >
          {IPUS.map((ipu) => (
            <Card
              key={ipu.id}
              as={Link}
              href={`/ipu/${ipu.slug}?ipu_id=${ipu.id}&name=${encodeURIComponent(ipu.name)}`}
              w={{ base: "100%", sm: "220px", md: "270px" }}
              bg="rgba(255,255,255,0.94)"
              borderWidth="3px"
              borderColor="rgba(243,112,33,0.35)"
              borderRadius="18px"
              boxShadow="0 10px 25px rgba(0,0,0,0.08)"
              _hover={{
                transform: "translateY(-4px)",
                boxShadow: "0 16px 34px rgba(0,0,0,0.1)",
                borderColor: "#1FA4C4",
              }}
              transition="all 0.18s"
            >
              <CardBody py={6} px={5}>
                <Box
                  w="102px"
                  h="102px"
                  mx="auto"
                  mb={4}
                  borderRadius="26px"
                  bg="white"
                  borderWidth="1px"
                  borderColor="rgba(0,0,0,0.06)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  overflow="hidden"
                >
                  {/* Copy Front End/ICS_true_logo.jpeg to public/ICS_true_logo.jpeg */}
                  <Box
                    as="img"
                    src="/ICS_true_logo.jpeg"
                    alt="ICS IPU"
                    w="74px"
                    h="74px"
                    objectFit="contain"
                  />
                </Box>
                <Heading size="md" fontWeight={560} mb={2}>
                  {ipu.name} IPU
                </Heading>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      </Box>
      <Box as="footer" textAlign="center" py={4} color="rgba(0,0,0,0.38)" fontSize="xs">
        © OHI • Innovative Care Solutions — Internal use only
      </Box>
    </>
  );
}
