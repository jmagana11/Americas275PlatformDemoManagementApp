import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {ProgressBar, Item, Form, TextField, ActionButton, ListBox, Heading, Flex } from '@adobe/react-spectrum'
import Function from '@spectrum-icons/workflow/Function'
import allActions from '../config.json'

function CreateSandbox(props){
    const [sandboxName, setSandboxName] = useState(null);
    const [_isJobLoading, set_IsJobLoading] = useState(false);
    
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

    function handleSandboxCreation(selection){
        setSandboxName(selection);
        //props.parentCallback(selection);
    }

    useEffect(() => {
        //code...
    }, []);

    return(
        <>
        <Heading>Create a Sandbox:</Heading>
            <ListBox aria-label="Alignment">
                <Item>1) Enter Sandbox Name</Item>
                <Item>2) Hit the Create Button</Item>
            </ListBox>
            <br></br>
        <Form onSubmit={handleSandboxCreation}>
            <TextField label="Sandbox Name:" />
            <Flex>
                <ActionButton disabled={false} type="submit">Create Sandbox</ActionButton>
            </Flex>
            {_isJobLoading && (
            <ProgressBar aria-label="Loading.." isIndeterminate={true} />
            )}
        </Form>
        </>
    )
}

export default CreateSandbox;