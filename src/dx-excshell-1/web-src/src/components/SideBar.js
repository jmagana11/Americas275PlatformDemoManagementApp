/* 
* <license header>
*/

import React from 'react'
import { NavLink } from 'react-router-dom'

function SideBar () {
  return (
    <ul className="SideNav">
      <li className="SideNav-item">
        <NavLink className="SideNav-itemLink" activeClassName="is-selected" aria-current="page" exact to="/">Home</NavLink>
      </li>
      <li className="SideNav-item">
        <NavLink className="SideNav-itemLink" activeClassName="is-selected" aria-current="page" to="/SegmentRefresh">Segment Refresh</NavLink>
      </li>
      <li className="SideNav-item">
        <NavLink className="SideNav-itemLink" activeClassName="is-selected" aria-current="page" to="/SandboxManagement">Sandbox Management (In dev)</NavLink>
      </li>
      <li className="SideNav-item">
        <NavLink className="SideNav-itemLink" activeClassName="is-selected" aria-current="page" to="/about">About App Builder</NavLink>
      </li>
    </ul>
  )
}

export default SideBar
