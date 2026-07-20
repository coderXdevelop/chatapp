import { StyleSheet, Text, View } from "react-native";
import { Title } from "../components/title";
import Profile from "../pages/profile";

export default function Index() {
  return (
    <View style={styles.container}>
      <Title style={styles.title}>Welcome to the Chat-App</Title>
      <Text style={styles.subtitle}>Connect • Share • Enjoy</Text>
      <Profile />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f4f8", // soft background
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    marginBottom: 20,
    fontStyle: "italic",
  },
});
