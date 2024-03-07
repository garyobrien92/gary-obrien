import { RouterProvider, createBrowserRouter } from "react-router-dom";

import Root from "./Root";

const router = createBrowserRouter([
  { path: "*", Component: Root },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
