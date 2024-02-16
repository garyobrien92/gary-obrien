import { NavLink } from "react-router-dom";
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  return (
    <div className='flex flex-col items-center justify-center'>
      <div className='flex'>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <nav id="sidebar" className='flex flex-col justify-start items-start px-2 gap-6'>
        <NavLink to="/about" className='text-2xl'>
          About
        </NavLink>
        <NavLink to="/projects" className='text-2xl'>Projects</NavLink>
      </nav>
    </div>
  )
}

export default App
