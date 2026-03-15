"use client";

import Link from "next/link";
import { Box, Button, Text, Link as ChakraLink } from "@chakra-ui/react";

type TopBarProps = {
  backHref: string;
  backLabel: string;
  orgLine?: string;
  addrLine?: string;
  rightAction?: { href: string; label: string };
};

export function TopBar({
  backHref,
  backLabel,
  orgLine = "OHI • Innovative Care Solutions",
  addrLine,
  rightAction,
}: TopBarProps) {
  return (
    <Box
      display="flex"
      alignItems="flex-start"
      justifyContent="space-between"
      gap={3}
      py={2}
      px={1}
    >
      <Box display="flex" flexDirection="column" gap={1} textAlign="left">
        <ChakraLink
          as={Link}
          href={backHref}
          display="inline-flex"
          alignItems="center"
          gap={2}
          color="rgba(15,23,42,0.58)"
          fontWeight={800}
          _hover={{ color: "rgba(15,23,42,0.7)", transform: "translateY(-1px)" }}
          transition="color 0.16s, transform 0.16s"
        >
          ← {backLabel}
        </ChakraLink>
        <Box>
          <Text fontSize="xs" fontWeight={800} color="rgba(15,23,42,0.55)">
            {orgLine}
          </Text>
          {addrLine && (
            <Text fontSize="xs" color="rgba(15,23,42,0.45)" fontWeight={600}>
              {addrLine}
            </Text>
          )}
        </Box>
      </Box>
      {rightAction && (
        <Button
          as={Link}
          href={rightAction.href}
          size="sm"
          variant="outline"
          borderRadius="12px"
          fontWeight={800}
          color="rgba(15,23,42,0.62)"
          bg="rgba(255,255,255,0.92)"
          borderColor="rgba(15,23,42,0.1)"
          _hover={{
            borderColor: "rgba(15,23,42,0.16)",
            bg: "white",
            transform: "translateY(-1px)",
          }}
        >
          {rightAction.label} ›
        </Button>
      )}
    </Box>
  );
}
