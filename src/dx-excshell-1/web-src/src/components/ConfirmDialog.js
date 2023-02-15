import React from 'react'
import { Heading, Dialog, Divider, ButtonGroup, Button, useDialogContainer } from '@adobe/react-spectrum'

function ConfirmDialog(props) {
    let dialog = useDialogContainer();

    function handleCreation(){
        props.parentCallback(true);
        dialog.dismiss();
    }

    function cancel(){
        dialog.dismiss();
    }

    return (
        <>
            <Dialog>
                <Heading>Please confirm that you would like to {props.description} {props.context ? `(${props.context})` : ''}: </Heading>
                <Divider />
                <ButtonGroup>
                    <Button variant="secondary" onPress={cancel}>Cancel</Button>
                    <Button variant="negative" onPress={handleCreation}>Create</Button>
                </ButtonGroup>
            </Dialog>
        </>
    );
}

export default ConfirmDialog