import { extendTheme } from "@chakra-ui/react";

const tealRgb = "20, 137, 168";
const orangeRgb = "243, 112, 33";

export const theme = extendTheme({
  fonts: {
    body: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    heading: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  colors: {
    brand: {
      teal: "#1489A8",
      orange: "#F37021",
      tealSoft: `rgba(${tealRgb}, 0.12)`,
      orangeSoft: `rgba(${orangeRgb}, 0.12)`,
    },
  },
  styles: {
    global: {
      "html, body": {
        minHeight: "100%",
        color: "rgba(15, 23, 42, 0.82)",
        bg: "linear-gradient(to bottom, #ffffff 0%, #ffffff 200px, #f4f6f9 200px, #f4f6f9 100%)",
      },
    },
  },
});
