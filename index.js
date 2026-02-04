import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';

// Always enable native screens to avoid passing screen-only props to plain RCTView.
enableScreens(true);

const App = require('./App').default;

AppRegistry.registerComponent('WalletAPP', () => App);
