import React, { useState, useEffect } from 'react'
import {ProgressBar, Item, Form, ActionButton, ListBox, Heading, Flex, DialogContainer, StatusLight } from '@adobe/react-spectrum'
import allActions from '../config.json'
import SandboxPicker from './SandboxPicker'
import DeleteDialog from './DeleteDialog'

function DeleteSandbox(props){
    const [deleteSandboxSubmit, setDeleteSandboxSubmit] = useState([]);
    const [selectedFirstPickerItem, setSelectedFirstPickerItem] = useState(null);
    const [isJobLoading, setIsJobLoading] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    let [dialog, setDialog] = useState(false);
    const [key, setKey] = useState(false);
    
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

    useEffect(() => {
        setKey(generateId());
    }, []);

    function handleRequestToDelete(event){
        event.preventDefault();
        console.log('SandboxToDelete: ', selectedFirstPickerItem)
        setDialog(true);

    }

    function handleSandboxSelection(selection){
        setSelectedFirstPickerItem(selection);
        //console.log("selection", selection)
    }

    function handleDeletion(data){
        if(data){
            console.log('call delete action:', selectedFirstPickerItem)
            setShowAlert(data);
            setKey(generateId());
        }
    }

    let generateId = () => Math.random().toString(36).substring(2, 10);

    return(
        <>
        <Heading>Delete a Sandbox:</Heading>
        <ListBox aria-label="Alignment">
            <Item>1) Select Sandbox Name</Item>
            <Item>2) Hit the Delete Button and confirm</Item>
        </ListBox>
        <Form onSubmit={handleRequestToDelete}>
            <SandboxPicker key={key} ims={props.ims} parentCallback={handleSandboxSelection} />
            <Flex>
                <ActionButton disabled={false} type="submit">Delete Sandbox</ActionButton>
            </Flex>
            {isJobLoading && (
            <ProgressBar aria-label="Loading.." isIndeterminate={true} />
            )}
            <DialogContainer onDismiss={() => setDialog(null)}>
                {dialog && (<DeleteDialog context={selectedFirstPickerItem} description={"SandboxName"} parentCallback={handleDeletion}/>)}
            </DialogContainer>
            {showAlert && (<StatusLight variant="positive">{`${selectedFirstPickerItem} has been deleted...`}</StatusLight>)}
        </Form>
        </>
    )
}

export default DeleteSandbox;