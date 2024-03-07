import { Outlet, Route, Routes } from "react-router-dom";
import AboutMe from "./pages/AboutMe";
import Projects from "./pages/Projects";
import NavBar from "./NavBar";

function Root() {
  return (
    <>

      <NavBar />

      <Routes>
        <Route path="/" element={<AboutMe />} />
        <Route path="/projects" element={<Projects />} />
      </Routes>  
    </>
  );
}

export default Root;