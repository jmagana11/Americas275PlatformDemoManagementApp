import React, { useState, useEffect } from 'react'
import { ProgressBar, Item, Form, TextField, ActionButton, ListBox, Heading, Flex, DialogContainer, StatusLight, ContextualHelp, Content, Text } from '@adobe/react-spectrum'
import ConfirmDialog from './ConfirmDialog'

function CreateSandbox(props) {
    const [sandboxName, setSandboxName] = useState("");
    const [_isJobLoading, set_IsJobLoading] = useState(false);
    const [opeConfirmation, setOpenConfirmation] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [sandboxTitle, setSandboxTitle] = useState("");

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

    function handleSandboxCreation(event) {
        event.preventDefault()
        console.log(sandboxName, JSON.stringify(fetchConfig));
        setShowConfirmation(false);
        if (sandboxName.length > 0 && sandboxTitle.length > 0) {
            setOpenConfirmation(true);
            setErrorMessage("valid")
        } else {
            setErrorMessage("invalid");
        }
    }

    function confirmation(data) {
        if (data) {
            console.log('sandbox to be Created:', sandboxName)
            setShowConfirmation(data);
        }

    }

    useEffect(() => {
        //code...
    }, []);

    return (
        <>
            <Heading>Create a Sandbox:</Heading>
            <StatusLight variant="negative">Fully functional UI without a backend. Purely concept purposes.</StatusLight>
            <ListBox aria-label="Alignment">
                <Item>1) Enter Sandbox Name and Title</Item>
                <Item>2) Hit the Create Button</Item>
            </ListBox>
            <Form isRequired={true} onSubmit={handleSandboxCreation}>
            <Flex direction="row">
                    <TextField width="size-6000" validationState={errorMessage} isRequired={true} label="Sandbox Name:" onChange={setSandboxName} />
                    <ContextualHelp variant="info" placement="top start" flex>
                        <Heading>Sandbox Title</Heading>
                        <Content>
                            <Text>
                                The Sandbox Name is an identifier of the sandbox and must be unique. This value can be found in the URL of Experience Platform apps. An Example:"demoX-0123" (Month and Year).
                            </Text>
                        </Content>
                    </ContextualHelp>
                </Flex>
                <Flex direction="row">
                    <TextField width="size-6000" validationState={errorMessage} isRequired={true} label="Sandbox Title:" onChange={setSandboxTitle} />
                    <ContextualHelp variant="info" placement="top start" flex>
                        <Heading>Sandbox Title</Heading>
                        <Content>
                            <Text>
                                The Sandbox Title is the description you see on the dropdown when selecting a sandbox in Experience Platform. An Example: "AJO DemoX" 
                            </Text>
                        </Content>
                    </ContextualHelp>
                </Flex >
                <Flex>
                    <ActionButton disabled={false} type="submit">Create Sandbox</ActionButton>
                </Flex>
                {_isJobLoading && (
                    <ProgressBar aria-label="Loading.." isIndeterminate={true} />
                )}
            </Form>
            <DialogContainer onDismiss={() => setOpenConfirmation(null)}>
                {opeConfirmation && (<ConfirmDialog context={sandboxName} description={"Create Sandbox"} parentCallback={confirmation} />)}
            </DialogContainer>
            <br></br>
            {showConfirmation && (<StatusLight variant="positive">{`${sandboxName} has been created...`}</StatusLight>)}
            {errorMessage == "invalid" && (<StatusLight variant="negative">Both fields are required and can't be empty</StatusLight>)}
        </>
    )
}

export default CreateSandbox;