export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
                body: ["IBM Plex Sans", "system-ui", "sans-serif"],
                mono: ["IBM Plex Mono", "SFMono-Regular", "monospace"],
            },
            boxShadow: {
                arena: "0 24px 80px rgba(8, 12, 24, 0.45)",
                glow: "0 0 32px rgba(247, 201, 72, 0.22)",
            },
            colors: {
                arena: {
                    ink: "#08111F",
                    night: "#0F172A",
                    panel: "rgba(10, 18, 32, 0.72)",
                    line: "rgba(124, 146, 180, 0.18)",
                    gold: "#F7C948",
                    ember: "#FF8A3D",
                    mint: "#67E8F9",
                    ice: "#D7F9FF",
                    violet: "#8B5CF6"
                }
            }
        },
    },
    plugins: [],
};
