/// <reference lib="dom" />
import { AppRegistry } from 'react-native';
import App from '../App';

AppRegistry.registerComponent('BakeShop', () => App);
AppRegistry.runApplication('BakeShop', {
  initialProps: {},
  // React Native's types expect a native tag; react-native-web takes the DOM node.
  rootTag: document.getElementById('root') as never,
});
