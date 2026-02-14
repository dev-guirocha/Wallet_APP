import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import App from './App';

// Always enable native screens to avoid passing screen-only props to plain RCTView.
enableScreens(true);

// Expo-native templates expect "main", while legacy native shells can still use "WalletAPP".
AppRegistry.registerComponent('main', () => App);
AppRegistry.registerComponent('WalletAPP', () => App);
