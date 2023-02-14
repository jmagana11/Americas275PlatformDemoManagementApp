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
    Item
} from '@adobe/react-spectrum'
import allActions from '../config.json'
import SandboxPicker from './SandboxPicker.js'
import SegmentPicker from './SegmentPicker.js'

function SegmentRefresh(props) {
    const [selectedFirstPickerItem, setSelectedFirstPickerItem] = useState(null);
    const [selectedSecondPickerItem, setSelectedSecondPickerItem] = useState(null);
    const [refreshedSegmentJobItem, setRefreshedSegmentJobItem] = useState(null);
    const [segmentStatusItem, setSegmentStatusItem] = useState(null);
    const [isJobLoading, setIsJobLoading] = useState(false);
    const [isStatusLoading, setIsStatusLoading] = useState(false);

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

    function handleSandboxSelection(data) {
        setSelectedFirstPickerItem(data);
    }

    function handleSegmentSelection(data) {
        setSelectedSecondPickerItem(data);
    }

    function handleSubmit(event) {
        event.preventDefault();
        console.log('handleSubmit/selectedSecondPickerITem', selectedSecondPickerItem)
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

    function handleSubmitSegmentRef(event) {
        event.preventDefault();
        setIsStatusLoading(true)
        console.log('handleSubmit/refreshedSegmentJobItem', refreshedSegmentJobItem)
        actionHeaders['sandboxName'] = selectedFirstPickerItem;
        actionHeaders['segmentId'] = selectedSecondPickerItem;
        actionHeaders['jobId'] = refreshedSegmentJobItem;

        fetch(allActions.getSegmentJobStatus, fetchConfig)
            .then((response) => response.json())
            .then((data) => {
                console.log('Form submitted successfully:', data);
                if (data) { setIsStatusLoading(false); }
                setSegmentStatusItem(data);
            })

    }


    return (
        <View width="size-6000">
            <Heading>Segment Refresh:</Heading>
            <ListBox aria-label="Alignment">
                <Item>1) Select a Sandbox</Item>
                <Item>2) Select a Segment</Item>
                <Item>3) Create a refresh job</Item>
                <Item>*Do not leave this tab to keep checking the status of your job ID</Item>
            </ListBox>
            <br></br>
            <Form onSubmit={handleSubmit}>
                <SandboxPicker ims={props.ims} parentCallback={handleSandboxSelection} />
                {selectedFirstPickerItem && (
                    <SegmentPicker ims={props.ims} parentCallbackSeg={handleSegmentSelection} sbxContext={selectedFirstPickerItem} />
                )}
                <Flex>
                    <ActionButton disabled={isJobLoading} type="submit">Submit</ActionButton>
                </Flex>
                {isJobLoading && (
                <ProgressBar aria-label="Loading.." isIndeterminate={true} />
                )}
            </Form>
            {refreshedSegmentJobItem && (
                <div><br></br>
                    <StatusLight variant="positive">{`Segment Job ID: ${refreshedSegmentJobItem}`}</StatusLight>
                    <br></br>
                    <Form onSubmit={handleSubmitSegmentRef}>
                        <Flex><ActionButton disabled={isStatusLoading} type="submit">Get Job Status</ActionButton></Flex>
                    </Form>
                    <br></br> 
                </div>
            )}
            {isStatusLoading && (
                <ProgressBar aria-label="Loading.." isIndeterminate={true} />
            )}
            {segmentStatusItem && (
                <div>
                    <br></br>
                    <StatusLight variant="positive">{`Status: ${segmentStatusItem.status}`}</StatusLight>
                </div>
            )}
        </View>
    );
}

SegmentRefresh.propTypes = {
    runtime: PropTypes.any,
    ims: PropTypes.any
}

export default SegmentRefresh