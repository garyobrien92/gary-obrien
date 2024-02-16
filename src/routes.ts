import {
    createBrowserRouter,
    RouterProvider,
  } from "react-router-dom";

  import App from './App'
  import AboutMe from './pages/AboutMe'
  import Projects from './pages/Projects'
  
  
  const router = createBrowserRouter([
    {
      path: "/",
      element: AboutMe
    },
    {
        path: "/about",
        element: AboutMe
      },
      {
        path: "/projects",
        element: Projects
      },
  ]);