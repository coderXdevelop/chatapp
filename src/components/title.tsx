import { StyleSheet, Text } from "react-native";

export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Text style={styles.title}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2c3e50",       
    textAlign: "center",    
    marginVertical: 10,     
    letterSpacing: 1,       
  },
});
