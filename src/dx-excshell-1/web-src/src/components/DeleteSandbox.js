import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {ProgressBar, Item, Form, TextField, ActionButton, ListBox, Heading, Flex, DialogContainer } from '@adobe/react-spectrum'
import Function from '@spectrum-icons/workflow/Function'
import allActions from '../config.json'
import SandboxPicker from './SandboxPicker'
import DeleteDialog from './DeleteDialog'

function DeleteSandbox(props){
    const [deleteSandboxSubmit, setDeleteSandboxSubmit] = useState([]);
    const [selectedFirstPickerItem, setSelectedFirstPickerItem] = useState(null);
    const [isJobLoading, setIsJobLoading] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    let [dialog, setDialog] = useState(false);
    
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

    function handleRequestToDelete(event){
        event.preventDefault();
        console.log('SandboxToDelete: ', selectedFirstPickerItem)
        setShowAlert(true)
        setDialog(true);

    }

    function handleSandboxSelection(selection){
        setSelectedFirstPickerItem(selection);
        //console.log("selection", selection)
    }

    useEffect(() => {
        //code...
    }, []);

    return(
        <>
        <Heading>Delete a Sandbox:</Heading>
            <ListBox aria-label="Alignment">
                <Item>1) Select Sandbox Name</Item>
                <Item>2) Hit the Delete Button and confirm</Item>
            </ListBox>
            <br></br>
        <Form onSubmit={handleRequestToDelete}>
            <SandboxPicker ims={props.ims} parentCallback={handleSandboxSelection} />
            <Flex>
                <ActionButton disabled={false} type="submit">Delete Sandbox</ActionButton>
            </Flex>
            {isJobLoading && (
            <ProgressBar aria-label="Loading.." isIndeterminate={true} />
            )}
            {showAlert && (
                <DialogContainer onDismiss={() => setDialog(null)}>
                    {dialog && (<DeleteDialog sbxContext={selectedFirstPickerItem} description={"SandboxName"}/>)}
                </DialogContainer>
            )}
        </Form>
        </>
    )
}

export default DeleteSandbox;