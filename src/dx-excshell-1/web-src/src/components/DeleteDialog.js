import React, { useState } from 'react'
import { Form, TextField, Heading, Dialog, Divider, Content, ButtonGroup, Button, useDialogContainer } from '@adobe/react-spectrum'

function DeleteDialog(props) {
    let dialog = useDialogContainer();
    const [context, setContext] = useState('');

    function handleDeletion(){
        
        if(context === props.context){
            console.log('Matched');
            props.parentCallback(true);
            dialog.dismiss();
        }else{
            console.log('NOTMatched');
            dialog.dismiss();
        }
        
    }

    function cancel(){
        dialog.dismiss();
    }

    return (
        <>
            <Dialog>
                <Heading>Please type the {props.description} ({props.context}): </Heading>
                <Divider />
                <Content>
                    <Form labelPosition="side" width="100%">
                        <TextField autoFocus label="SandboxName:" onChange={setContext} value={context}/>
                    </Form>
                </Content>
                <ButtonGroup>
                    <Button variant="secondary" onPress={cancel}>Cancel</Button>
                    <Button variant="negative" onPress={handleDeletion}>Delete</Button>
                </ButtonGroup>
            </Dialog>
        </>
    );
}

export default DeleteDialog