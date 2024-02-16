function Projects() {  
    const projects = [
        {
            title: 'Senior Full Stack engineer',
            company: 'OverC',
            content: 'Worked as blah blah',
            duration: '6 Years'
        },
        {
            title: 'Analast',
            company: 'Dell',
            summary: 'Worked with finaice team',
            duration: '1 Year'
        }
    ]
    return (
        <div>
            {
                projects.map((project, i) => 
                    <div key={i} className="project">
                        <h3>{project.title} - {project.duration}</h3>
                    </div>
                )
            }
        </div>
    )
  }
  
  export default Projects