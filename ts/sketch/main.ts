import './style.css';
import { h, render } from 'preact';
import { App } from './App';

const container = document.getElementById('app');
if (container) {
  render(<App />, container);
}