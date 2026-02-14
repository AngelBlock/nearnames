// Shim for react-dom/client (React 18 API) using React 17's ReactDOM.render.
// Needed because @near-wallet-selector/modal-ui@10 imports createRoot
// but this project uses React 17 which doesn't have react-dom/client.
import ReactDOM from 'react-dom';

export function createRoot(container) {
  return {
    render(element) {
      ReactDOM.render(element, container);
    },
    unmount() {
      ReactDOM.unmountComponentAtNode(container);
    }
  };
}
