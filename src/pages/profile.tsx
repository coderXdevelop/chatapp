import { StyleSheet, Text, View } from 'react-native';
import { Title } from '../components/title';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

function Profile() {
  return (
    <View style={styles.container}>
      <Title>Profile</Title>
      <Text>Name: John Doe</Text>
      <Text>Email: johndoe@example.com</Text>
    </View>
  );
}

export default Profile;
