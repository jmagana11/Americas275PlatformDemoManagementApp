import React from 'react'
import { Heading, Dialog, Divider, ButtonGroup, Button, useDialogContainer, Content, Text } from '@adobe/react-spectrum'

function ConfirmDialogJmeter(props) {
    let dialog = useDialogContainer();

    function handleCreation() {
        props.onClose();
        dialog.dismiss();
    }

    function cancel() {
        dialog.dismiss();
    }

    // Parse the result JSON safely
    let parsedResult = null;
    let isSuccess = false;
    let displayMessage = '';
    let details = '';

    try {
        parsedResult = JSON.parse(props.result);
        
        if (parsedResult.error) {
            // Error case
            isSuccess = false;
            displayMessage = parsedResult.message || 'An error occurred';
            details = parsedResult.details ? JSON.stringify(parsedResult.details, null, 2) : '';
        } else if (parsedResult.pid) {
            // Success case
            isSuccess = true;
            displayMessage = 'Congratulations! Your report request has been generated.';
            details = `Process ID: ${parsedResult.pid}`;
        } else {
            // Unknown response format
            isSuccess = false;
            displayMessage = 'Unexpected response format';
            details = JSON.stringify(parsedResult, null, 2);
        }
    } catch (error) {
        // JSON parsing failed
        isSuccess = false;
        displayMessage = 'Invalid response format';
        details = props.result || 'No response data';
    }

    return (
        <>
            <Dialog>
                <Heading>{isSuccess ? 'Success' : 'Error'}</Heading>
                <Divider />
                <Content>
                    <Text>{displayMessage}</Text>
                    {details && (
                        <>
                            <br />
                            <Text><strong>Details:</strong></Text>
                            <pre style={{ 
                                backgroundColor: '#f5f5f5', 
                                padding: '8px', 
                                borderRadius: '4px',
                                fontSize: '12px',
                                overflow: 'auto',
                                maxHeight: '200px'
                            }}>
                                {details}
                            </pre>
                        </>
                    )}
                </Content>
                <ButtonGroup>
                    <Button variant={isSuccess ? "positive" : "negative"} onPress={handleCreation}>
                        Close
                    </Button>
                </ButtonGroup>
            </Dialog>
        </>
    );
}

export default ConfirmDialogJmeter