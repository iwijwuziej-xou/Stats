import { findByProps } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";
import { Forms } from "@vendetta/ui/components";

const { View, Text, StyleSheet, TouchableOpacity } = ReactNative;
const { FormSection, FormText } = Forms;

let patches: Array<() => void> = [];
let overlayVisible = true;

function getVoiceStores() {
    const VoiceStateStore = findByProps("getVoiceStateForChannel", "isSelfMute");
    const VoiceConnectionStore = findByProps("getConnection", "getPing");
    const SelectedChannelStore = findByProps("getVoiceChannelId", "getChannelId");

    return { VoiceStateStore, VoiceConnectionStore, SelectedChannelStore };
}

function readVoiceMetrics() {
    const { VoiceStateStore, VoiceConnectionStore, SelectedChannelStore } = getVoiceStores();
    if (!VoiceStateStore || !VoiceConnectionStore || !SelectedChannelStore) {
        return {
            speaking: false,
            selfMute: false,
            selfDeaf: false,
            bitrate: null as number | null,
            packetLoss: null as number | null,
            jitter: null as number | null,
            ping: null as number | null,
        };
    }

    const channelId = SelectedChannelStore.getVoiceChannelId?.();
    const conn = channelId ? VoiceConnectionStore.getConnection?.(channelId) : null;
    const vs = channelId ? VoiceStateStore.getVoiceStateForChannel?.(channelId) : null;

    const stats: any = conn?.stats || conn?.getStats?.() || {};

    return {
        speaking: !!vs?.isSpeaking,
        selfMute: !!vs?.isSelfMute,
        selfDeaf: !!vs?.isSelfDeaf,
        bitrate: stats.bitrate ?? stats.audioBitrate ?? null,
        packetLoss: stats.packetLoss ?? stats.audioPacketLoss ?? null,
        jitter: stats.jitter ?? stats.audioJitter ?? null,
        ping: conn?.ping ?? stats.ping ?? null,
    };
}

const VoiceOverlay: React.FC = () => {
    const [metrics, setMetrics] = React.useState(readVoiceMetrics());
    const [expanded, setExpanded] = React.useState(true);

    React.useEffect(() => {
        let mounted = true;
        const interval = setInterval(() => {
            if (!mounted) return;
            setMetrics(readVoiceMetrics());
        }, 500);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    if (!overlayVisible) return null;

    const colorSpeaking = metrics.speaking ? "#4ade80" : "#f97373";
    const colorMute = metrics.selfMute ? "#f97373" : "#a3e635";
    const colorDeaf = metrics.selfDeaf ? "#f97373" : "#a3e635";

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
                <View style={styles.header}>
                    <Text style={styles.headerText}>Voice Analyzer</Text>
                    <Text style={styles.headerSub}>{expanded ? "tap to collapse" : "tap to expand"}</Text>
                </View>
            </TouchableOpacity>
            {expanded && (
                <View style={styles.body}>
                    <View style={styles.row}>
                        <Text style={styles.label}>Speaking:</Text>
                        <Text style={[styles.value, { color: colorSpeaking }]}>
                            {metrics.speaking ? "YES" : "NO"}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Self Mute:</Text>
                        <Text style={[styles.value, { color: colorMute }]}>
                            {metrics.selfMute ? "ON" : "OFF"}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Self Deaf:</Text>
                        <Text style={[styles.value, { color: colorDeaf }]}>
                            {metrics.selfDeaf ? "ON" : "OFF"}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Bitrate:</Text>
                        <Text style={styles.value}>
                            {metrics.bitrate != null ? `${metrics.bitrate} kbps` : "—"}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Packet Loss:</Text>
                        <Text style={styles.value}>
                            {metrics.packetLoss != null ? `${metrics.packetLoss}%` : "—"}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Jitter:</Text>
                        <Text style={styles.value}>
                            {metrics.jitter != null ? `${metrics.jitter} ms` : "—"}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Ping:</Text>
                        <Text style={styles.value}>
                            {metrics.ping != null ? `${metrics.ping} ms` : "—"}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        right: 8,
        top: 80,
        padding: 8,
        borderRadius: 10,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.7)",
        zIndex: 9999,
        maxWidth: "70%",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    headerText: {
        color: "#e5e7eb",
        fontWeight: "700",
        fontSize: 12,
    },
    headerSub: {
        color: "#9ca3af",
        fontSize: 10,
    },
    body: {
        marginTop: 2,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginVertical: 1,
    },
    label: {
        color: "#9ca3af",
        fontSize: 11,
    },
    value: {
        color: "#e5e7eb",
        fontSize: 11,
        marginLeft: 8,
    },
});

function injectOverlayIntoRoot() {
    const AppRoot = findByProps("App", "AppView");
    if (!AppRoot || !AppRoot.App) return;

    const unpatch = before("App", AppRoot, (args: any[]) => {
        const orig = args[0]?.children;
        args[0].children = (
            <>
                {orig}
                <VoiceOverlay />
            </>
        );
        return args;
    });

    return unpatch;
}

const SettingsPage: React.FC = () => (
    <FormSection title="Voice Analyzer (Kettu / iOS)">
        <FormText>Overlay: Live voice metrics for Discord iOS.</FormText>
        <FormText>Shows speaking state, mute/deaf, bitrate, packet loss, jitter, ping.</FormText>
        <FormText>Environment: Discord 305.1 • React 19 • RN 0.78 • KettuTweak 2.0.0</FormText>
    </FormSection>
);

const index = {
    onLoad() {
        try {
            const rootPatch = injectOverlayIntoRoot();
            if (rootPatch) patches.push(rootPatch);
            console.log("[VoiceAnalyzer] Online for Discord iOS / KettuTweak.");
        } catch (e) {
            console.error("[VoiceAnalyzer] Startup failure:", e);
        }
    },
    onUnload() {
        patches.forEach((unpatch) => {
            try {
                unpatch?.();
            } catch {}
        });
        patches = [];
    },
    settings: SettingsPage,
};

export default index;
