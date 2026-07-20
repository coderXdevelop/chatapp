import { StyleSheet, View } from "react-native";
import { Title } from "../components/title";
import Profile from "../pages/profile";

export default function Index() {
  return (
    <View style={styles.container}>
      <Title>Welcome to the Chat-App</Title>
      <Profile />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
