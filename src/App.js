import React from 'react'
import './index.css'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import DocViewer from './components/doc-viewer'

function App() {
  return (
    <Router>
      <Switch>
        <Route path="/app/:userId/:repoKey/:docKey">
          <DocViewer />
        </Route>
        <Route>
          <div className="font-sans mt-32 text-center text-xl font-bold">Invalid doc url</div>
        </Route>       
      </Switch>
    </Router>
  )
}

export default App
