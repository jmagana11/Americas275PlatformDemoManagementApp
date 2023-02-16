import React from 'react'
import { Heading, Dialog, Divider, ButtonGroup, Button, useDialogContainer, Content } from '@adobe/react-spectrum'

function ConfirmDialogJmeter(props) {
    let dialog = useDialogContainer();

    function handleCreation() {
        props.parentCallback(true);
        dialog.dismiss();
    }

    function cancel() {
        dialog.dismiss();
    }

    return (
        <>
            <Dialog>
                <Heading>Status</Heading>
                <Divider />
                <Content>
                    Congratulations! Your report request has been generated.<br></br>
                    {props.message}
                </Content>
                <ButtonGroup>
                    <Button variant="positive" onPress={handleCreation}>Close</Button>
                </ButtonGroup>
            </Dialog>
        </>
    );
}

export default ConfirmDialogJmeter