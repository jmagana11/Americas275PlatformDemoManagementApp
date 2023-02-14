import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
    Flex,
    Heading,
    Form,
    ActionButton,
    StatusLight,
    ProgressBar,
    View,
    ListBox,
    Item,
    TextField, 
    Tabs,
    TabList,
    TabPanels
} from '@adobe/react-spectrum'
import allActions from '../config.json'
import CreateSandbox from './CreateSandbox'
import DeleteSandbox from './DeleteSandbox'

function SandboxManagement(props) {

    console.log('sbxMgmtIms: ', props.ims)

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

    function handleSubmit(event) {
        event.preventDefault();
        actionHeaders['sandboxName'] = selectedFirstPickerItem;
        actionHeaders['segmentId'] = selectedSecondPickerItem;
        setIsJobLoading(true)
        fetch(allActions.refreshSegment, fetchConfig)
            .then((response) => response.json())
            .then((data) => {
                console.log('Form submitted successfully:', data);
                setRefreshedSegmentJobItem(data.id);
                if (data) { setIsJobLoading(false); }
            });
    }

    return (
        <View width="size-6000">
            <Heading>Sandbox Management Services:</Heading>
            <Tabs aria-label="History of Ancient Rome">
                <TabList>
                    <Item key="create">Create Sandbox</Item>
                    <Item key="delete">Delete Sandbox</Item>
                </TabList>
                <TabPanels>
                    <Item key="create">
                        <CreateSandbox ims={props.ims} />
                    </Item>
                    <Item key="delete">
                        <DeleteSandbox ims={props.ims} />
                    </Item>
                </TabPanels>
            </Tabs>
        </View>
    );
}

export default SandboxManagement