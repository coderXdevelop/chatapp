import { StyleSheet, Text, View } from 'react-native';
import { Title } from '../components/title';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export function Login() {
  return (
    <View style={styles.container}>
      <Title>Login</Title>
      <Text>Login Page</Text>
    </View>
  );
}

export function Register() {
  return (
    <View style={styles.container}>
      <Title>Register</Title>
      <Text>Register Page</Text>
    </View>
  );
}

