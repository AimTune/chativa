import { createStore } from "zustand/vanilla";
import type { remSizes } from "../styles/calculatedTypes";

export interface IThemeSettings {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
    positionMargin?: "1" | "2" | "3" | "4" | "5";
    size?: "small" | "medium" | "large";

    layout?: {
        width?: remSizes | string;
        height?: remSizes | string;
        maxWidth?: string | number;
        maxHeight?: string | number;
    }
}

export interface IChatBotStore {
    // Chat widget state management
    isOpened: boolean;
    isRendered: boolean;
    toggle: () => void;
    close: () => void;
    open: () => void;

    // Theme management
    theme: IThemeSettings;
    setTheme: (theme: IThemeSettings) => void;
    getTheme: () => IThemeSettings;
    subscribe: (cb: () => void) => () => void;
}

const store = createStore<IChatBotStore>((setState) => ({
    // Chat widget state management
    isOpened: true,
    isRendered: false,
    toggle: () => setState((state) => ({ isOpened: !state.isOpened })),
    close: () => setState(() => ({ isOpened: false })),
    open: () => setState(() => ({ isOpened: true, isRendered: true })),

    // Theme management
    theme: {
        primaryColor: "#007bff",
        secondaryColor: "#6c757d",
        backgroundColor: "#ffffff",
        textColor: "#212529",
        borderColor: "#dee2e6",
        position: "bottom-right",
        marginX: "20px",
        marginY: "20px",
        size: "medium",
        layout: {
            width: "18rem",
            height: "20rem",
            maxWidth: "100%",
            maxHeight: "100%",
        }
    },
    setTheme: (theme: IThemeSettings) => setState({ theme }),
    getTheme: (): IThemeSettings => store.getState().theme,
    subscribe: (cb) => {
        const unsubscribe = store.subscribe(() => cb());
        return () => unsubscribe();
    },
}));

export default store;
