import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Form, TextField, Heading, Dialog, Divider, Content, ButtonGroup, Button, useDialogContainer, DialogContainer, Flex } from '@adobe/react-spectrum'
import Function from '@spectrum-icons/workflow/Function'
import allActions from '../config.json'

function DeleteDialog(props) {
    let dialog = useDialogContainer();
    const [sbxName, setSbxName] = useState('');

    function handleDeletion(){
        
        if(sbxName === props.sbxContext){
            console.log('Matched');
            dialog.dismiss();
            alert(`Sandbox: ${props.sbxContext} has been deleted!`);
        }else{
            console.log('NOTMatched');
            dialog.dismiss();
            alert(`Sandbox: ${sbxName} couldn't be found!`);
        }
        
    }

    return (
        <>
            <Dialog>
                <Heading>Please type the {props.description} ({props.sbxContext}): </Heading>
                <Divider />
                <Content>
                    <Form labelPosition="side" width="100%">
                        <TextField autoFocus label="SandboxName:" onChange={setSbxName} value={sbxName}/>
                        <Flex>
                        </Flex>
                    </Form>
                    <ButtonGroup>
                            <Button variant="negative" onPress={handleDeletion}>Delete</Button>
                    </ButtonGroup>
                </Content>
            </Dialog>
        </>
    );
}

export default DeleteDialog