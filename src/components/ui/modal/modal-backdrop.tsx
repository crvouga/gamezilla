import type { PropsWithChildren } from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "@/@shared/theme";

type ModalBackdropProps = PropsWithChildren<{
    onPress: () => void;
}>;

export function ModalBackdrop({ onPress, children }: ModalBackdropProps) {
    const theme = useTheme();

    return (
        <View style={theme.sx({ flex: 1 })}>
            <Pressable
                onPress={onPress}
                style={theme.sx({
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)",
                })}
            />
            <View
                style={theme.sx({ flex: 1, justifyContent: "center", alignItems: "center" })}
                pointerEvents="box-none"
            >
                <View pointerEvents="auto">{children}</View>
            </View>
        </View>
    );
}
