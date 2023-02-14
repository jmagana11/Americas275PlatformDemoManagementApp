import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {Picker,ProgressBar,Item} from '@adobe/react-spectrum'
import Function from '@spectrum-icons/workflow/Function'
import allActions from '../config.json'

function SandboxPicker(props){
    const [firstPickerItems, setFirstPickerItems] = useState([]);
    const [selectedFirstPickerItem, setSelectedFirstPickerItem] = useState(null);
    
    const actionHeaders = {
        'Content-Type': 'application/json'
    }

    const fetchConfig = {
        headers: actionHeaders
    }

    if (window.location.hostname === 'localhost') {
        actionHeaders['x-ow-extra-logging'] = 'on'
    }

    // set the authorization header and org from the ims props object
    if (props.ims.token && !actionHeaders.authorization) {
        actionHeaders.authorization = `Bearer ${props.ims.token}`
    }
    if (props.ims.org && !actionHeaders['x-gw-ims-org-id']) {
        actionHeaders['x-gw-ims-org-id'] = props.ims.org
    }

    function handleSelection(selection){
        setSelectedFirstPickerItem(selection);
        props.parentCallback(selection);
    }

    useEffect(() => {
        fetch(allActions.getsandboxes, fetchConfig)
            .then((response) => response.json())
            .then((data) => {
                const options = data.sandboxes.map((item) => ({
                    name: item.name,
                    value: item.eTag
                }));
                setFirstPickerItems(options);
            });
    }, []);

    return(
    <Picker
        label="Sandbox Picker:"
        isRequired={true}
        placeholder="Select an item"
        aria-label="Select an item for the first picker"
        items={firstPickerItems}
        itemKey="name"
        onSelectionChange={(name) => {
            console.log(`value: ${name}`)
            handleSelection(name);
        }}>
        {(item) => <Item key={item.name}>{item.name}</Item>}
    </Picker>)
}

export default SandboxPicker;