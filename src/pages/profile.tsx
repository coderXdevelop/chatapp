import { StyleSheet, Text, View } from 'react-native';
import { Title } from '../components/title';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa', // soft background
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  text: {
    fontSize: 18,
    color: '#34495e',
    marginVertical: 5,
  },
  highlight: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2980b9',
  },
  footer: {
    marginTop: 30,
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
});

function Profile() {
  return (
    <View style={styles.container}>
      <Title style={styles.title}>Profile</Title>
      <Text style={styles.text}>
        Name: <Text style={styles.highlight}>John Doe</Text>
      </Text>
      <Text style={styles.text}>
        Email: <Text style={styles.highlight}>johndoe@example.com</Text>
      </Text>
      <Text style={styles.text}>
        Role: <Text style={styles.highlight}>Software Engineer</Text>
      </Text>
      <Text style={styles.text}>
        Location: <Text style={styles.highlight}>San Francisco, CA</Text>
      </Text>
      <Text style={styles.footer}>
        "Building great apps, one line of code at a time."
      </Text>
    </View>
  );
}

export default Profile;
