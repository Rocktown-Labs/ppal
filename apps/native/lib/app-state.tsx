import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authClient } from "@/lib/auth-client";

export interface MobileUser {
  email: string;
  /** Demo accounts render fixture data; real accounts hit the live API. */
  isDemo: boolean;
  handle: string;
  name: string;
  verified: boolean;
}

/** Email of the built-in demo account (fixture data on every screen). */
export const DEMO_USER_EMAIL = "bettor@parlaypal.com";

export const isDemoUser = (user: MobileUser | null): boolean =>
  user?.isDemo === true || user?.email === DEMO_USER_EMAIL;

export interface AppPermissions {
  notifications: boolean;
  photos: boolean;
}

interface AppStateContextType {
  completeOnboarding: (sports: string[]) => Promise<void>;
  hasCompletedOnboarding: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  isUploadModalOpen: boolean;
  loginAsDemo: () => Promise<void>;
  loginReal: (user: {
    email: string;
    handle?: string;
    name: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  permissions: AppPermissions;
  resetOnboarding: () => Promise<void>;
  selectedSports: string[];
  setIsUploadModalOpen: (open: boolean) => void;
  setPermission: (key: keyof AppPermissions, granted: boolean) => Promise<void>;
  setSelectedSports: (sports: string[]) => void;
  user: MobileUser | null;
}

const STORAGE_KEYS = {
  HAS_ONBOARDED: "ppal_has_onboarded",
  PERMISSIONS: "ppal_permissions",
  SELECTED_SPORTS: "ppal_selected_sports",
  USER: "ppal_user",
};

const DEFAULT_DEMO_USER: MobileUser = {
  email: DEMO_USER_EMAIL,
  handle: "courtvision_picks",
  isDemo: true,
  name: "Marcus Vance",
  verified: true,
};

const DEFAULT_SPORTS = ["NBA", "NFL", "MLB", "UFC"];

const AppStateContext = createContext<AppStateContextType | undefined>(
  undefined
);

export const AppStateProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [permissions, setPermissions] = useState<AppPermissions>({
    notifications: false,
    photos: false,
  });
  const [selectedSports, setSelectedSportsState] =
    useState<string[]>(DEFAULT_SPORTS);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    async function loadStoredState() {
      let storedUser: MobileUser | null = null;
      try {
        const [rawUser, storedOnboarded, storedPerms, storedSports] =
          await Promise.all([
            SecureStore.getItemAsync(STORAGE_KEYS.USER),
            SecureStore.getItemAsync(STORAGE_KEYS.HAS_ONBOARDED),
            SecureStore.getItemAsync(STORAGE_KEYS.PERMISSIONS),
            SecureStore.getItemAsync(STORAGE_KEYS.SELECTED_SPORTS),
          ]);

        if (rawUser) {
          // Users stored before the isDemo flag existed are demo users.
          const parsed = JSON.parse(rawUser) as Partial<MobileUser>;
          const candidate: MobileUser = {
            email: parsed.email ?? "",
            handle: parsed.handle ?? "",
            isDemo: parsed.isDemo ?? parsed.email === DEMO_USER_EMAIL,
            name: parsed.name ?? "",
            verified: parsed.verified ?? false,
          };
          // Release builds never run the demo tour; evict any stored demo
          // marker so nobody is stuck in the fixture sandbox on a store build.
          if (candidate.isDemo && !__DEV__) {
            await SecureStore.deleteItemAsync(STORAGE_KEYS.USER).catch(
              () => {}
            );
          } else {
            storedUser = candidate;
            setUser(storedUser);
          }
        }

        if (storedOnboarded === "true") {
          setHasCompletedOnboarding(true);
        }

        if (storedPerms) {
          setPermissions(JSON.parse(storedPerms));
        }

        if (storedSports) {
          setSelectedSportsState(JSON.parse(storedSports));
        }
      } catch {
        // Fallback gracefully on fresh install
      }

      // Reconcile the local marker with the real better-auth session so a
      // signed-in account restores on launch and a stale marker clears out.
      try {
        const session = await authClient.getSession();
        if (session.data?.user) {
          const realUser: MobileUser = {
            email: session.data.user.email,
            handle: "",
            isDemo: false,
            name: session.data.user.name,
            verified: true,
          };
          if (!storedUser || isDemoUser(storedUser)) {
            setUser(realUser);
            await SecureStore.setItemAsync(
              STORAGE_KEYS.USER,
              JSON.stringify(realUser)
            );
          }
        } else if (storedUser && !isDemoUser(storedUser)) {
          // Session expired or revoked; require signing in again.
          setUser(null);
          await SecureStore.deleteItemAsync(STORAGE_KEYS.USER);
        }
      } catch {
        // Offline: keep whatever was restored locally.
      } finally {
        setIsLoading(false);
      }
    }

    loadStoredState();
  }, []);

  const loginAsDemo = useCallback(async () => {
    // The fixture tour is a development affordance; release builds never
    // fabricate a demo session.
    if (!__DEV__) {
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setUser(DEFAULT_DEMO_USER);
      await SecureStore.setItemAsync(
        STORAGE_KEYS.USER,
        JSON.stringify(DEFAULT_DEMO_USER)
      );
    } catch {
      setUser(DEFAULT_DEMO_USER);
    }
  }, []);

  const loginReal = useCallback(
    async (input: { email: string; handle?: string; name: string }) => {
      const realUser: MobileUser = {
        email: input.email,
        handle: input.handle ?? "",
        isDemo: false,
        name: input.name,
        verified: true,
      };
      setUser(realUser);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await SecureStore.setItemAsync(
          STORAGE_KEYS.USER,
          JSON.stringify(realUser)
        );
      } catch {
        // Local persistence is best-effort.
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Sign out the real session when present; harmless for demo users.
      await authClient.signOut();
    } catch {
      // Sign-out failures fall through to clearing local state.
    }
    setUser(null);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER).catch(() => {});
  }, []);

  const setPermission = useCallback(
    async (key: keyof AppPermissions, granted: boolean) => {
      const nextPerms = { ...permissions, [key]: granted };
      setPermissions(nextPerms);
      await SecureStore.setItemAsync(
        STORAGE_KEYS.PERMISSIONS,
        JSON.stringify(nextPerms)
      );
    },
    [permissions]
  );

  const setSelectedSports = useCallback((sports: string[]) => {
    setSelectedSportsState(sports);
    SecureStore.setItemAsync(
      STORAGE_KEYS.SELECTED_SPORTS,
      JSON.stringify(sports)
    );
  }, []);

  const completeOnboarding = useCallback(
    async (sports: string[]) => {
      setHasCompletedOnboarding(true);
      setSelectedSportsState(sports);
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.HAS_ONBOARDED, "true"),
        SecureStore.setItemAsync(
          STORAGE_KEYS.SELECTED_SPORTS,
          JSON.stringify(sports)
        ),
      ]);
    },
    []
  );

  const resetOnboarding = useCallback(async () => {
    setHasCompletedOnboarding(false);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.HAS_ONBOARDED);
  }, []);

  const value = useMemo(
    () => ({
      completeOnboarding,
      hasCompletedOnboarding,
      isAuthenticated: Boolean(user),
      isLoading,
      isUploadModalOpen,
      loginAsDemo,
      loginReal,
      logout,
      permissions,
      resetOnboarding,
      selectedSports,
      setIsUploadModalOpen,
      setPermission,
      setSelectedSports,
      user,
    }),
    [
      completeOnboarding,
      hasCompletedOnboarding,
      isLoading,
      isUploadModalOpen,
      loginAsDemo,
      loginReal,
      logout,
      permissions,
      resetOnboarding,
      selectedSports,
      setIsUploadModalOpen,
      setPermission,
      setSelectedSports,
      user,
    ]
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
