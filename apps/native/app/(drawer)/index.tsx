import { Ionicons } from "@expo/vector-icons";
import { Card, Chip, useThemeColor } from "heroui-native";
import { Text, View, Pressable } from "react-native";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const { data: session } = authClient.useSession();

  const mutedColor = useThemeColor("muted");
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");
  const foregroundColor = useThemeColor("foreground");

  return (
    <Container className="p-6">
      <View className="mb-6 py-4">
        <Text className="text-foreground mb-2 text-4xl font-bold">
          BETTER T STACK
        </Text>
      </View>

      {session?.user ? (
        <Card variant="secondary" className="mb-6 p-4">
          <Text className="text-foreground mb-2 text-base">
            Welcome, <Text className="font-medium">{session.user.name}</Text>
          </Text>
          <Text className="text-muted mb-4 text-sm">{session.user.email}</Text>
          <Pressable
            className="bg-danger self-start rounded-lg px-4 py-3 active:opacity-70"
            onPress={() => {
              authClient.signOut();
            }}
          >
            <Text className="text-foreground font-medium">Sign Out</Text>
          </Pressable>
        </Card>
      ) : null}

      {!session?.user && (
        <>
          <SignIn />
          <SignUp />
        </>
      )}
    </Container>
  );
}
