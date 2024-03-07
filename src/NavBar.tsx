import { NavLink } from "react-router-dom";

export default function NavBar() {
  return (
      <nav id="sidebar" className='flex flex-row justify-center items-start px-2 gap-6'>
        <NavLink to="/" className='text-2xl'>
          About
        </NavLink>
        <NavLink to="/projects" className='text-2xl'>Projects</NavLink>
      </nav>
  )
}