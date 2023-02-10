import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {
    Flex,
    Heading,
    Form,
    Picker,
    ActionButton,
    StatusLight,
    ProgressBar,
    Item,
    View
} from '@adobe/react-spectrum'
import Function from '@spectrum-icons/workflow/Function'
import allActions from '../config.json'

function SegmentRefresh(props) {
    const [firstPickerItems, setFirstPickerItems] = useState([]);
    const [secondPickerItems, setSecondPickerItems] = useState([]);
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

    useEffect(() => {
        fetch(allActions.getsandboxes, fetchConfig)
            .then((response) => response.json())
            .then((data) => {
                const options = data.sandboxes.map((item) => ({
                    name: item.name,
                    value: item.eTag
                }));
                setFirstPickerItems(options);
            });
    }, []);

    useEffect(() => {
        if (!selectedFirstPickerItem) {
            return;
        }
        console.log("secondPicker FirstItem selected", selectedFirstPickerItem)
        actionHeaders['sandboxName'] = selectedFirstPickerItem;
        fetch(allActions.getSegments, fetchConfig)
            .then((response) => response.json())
            .then((data) => {
                const options = data.segments.map((item) => ({
                    name: item.name,
                    value: item.id
                }));
                console.log(JSON.stringify(options));
                setSecondPickerItems(options);
            });

    }, [selectedFirstPickerItem]);

    function handleSubmit(event) {
        event.preventDefault();
        console.log('handleSubmit/selectedSecondPickerITem',selectedSecondPickerItem)
        actionHeaders['sandboxName'] = selectedFirstPickerItem;
        actionHeaders['segmentId'] = selectedSecondPickerItem;
        setIsJobLoading(true)
        fetch(allActions.refreshSegment, fetchConfig)
            .then((response) => response.json())
            .then((data) => {
                console.log('Form submitted successfully:', data);
                setRefreshedSegmentJobItem(data.id);
                if(data){setIsJobLoading(false);}
            });
    }

    function handleSubmitSegmentRef(event){
        event.preventDefault();
        setIsStatusLoading(true)
        console.log('handleSubmit/refreshedSegmentJobItem',refreshedSegmentJobItem)
        actionHeaders['sandboxName'] = selectedFirstPickerItem;
        actionHeaders['segmentId'] = selectedSecondPickerItem;
        actionHeaders['jobId'] = refreshedSegmentJobItem;

        fetch(allActions.getSegmentJobStatus, fetchConfig)
            .then((response) => response.json())
            .then((data) => {
                console.log('Form submitted successfully:', data);
                if(data){setIsStatusLoading(false);}
                setSegmentStatusItem(data);
            })

    }


    return (
        <View width="size-6000">
            <Heading>Please Select a Sandbox, then a Segment. Stay on this page to keep getting status. If you close the browser tab or navigate to other parts within the app, you'll lose your changes</Heading>
            <Form onSubmit={handleSubmit}>
                <Picker
                    label="Sandbox Picker:"
                    isRequired={true}
                    placeholder="Select an item"
                    aria-label="Select an item for the first picker"
                    items={firstPickerItems}
                    itemKey="name"
                    onSelectionChange={(name) => {
                        console.log(`value: ${name}`)
                        setSelectedFirstPickerItem(name);
                    }}>
                    {(item) => <Item key={item.name}>{item.name}</Item>}
                </Picker>
                {console.log("selectedFirstPickerItem", selectedFirstPickerItem)}
                {selectedFirstPickerItem && ( <Picker
                    label="Second Picker"
                    placeholder="Select an item"
                    aria-label="Select anitem for the first picker"
                    items={secondPickerItems}
                    itemKey="value"
                    onSelectionChange={(value) => { setSelectedSecondPickerItem(value); }}>
                    {(item) => <Item key={item.value}>{item.name}</Item>}
                </Picker>)}
                <Flex><ActionButton disabled={isJobLoading} type="submit">Submit</ActionButton></Flex>
                {isJobLoading && ( <ProgressBar 
                                aria-label="Loading.."
                                isIndeterminate={true}/>) }
            </Form>
            {refreshedSegmentJobItem && ( 
                <div><br></br>
                <StatusLight variant="positive">{`Segment Job ID: ${refreshedSegmentJobItem}`}</StatusLight>
                <br></br>
                <Form onSubmit={handleSubmitSegmentRef}>
                    <Flex><ActionButton disabled={isStatusLoading} type="submit">Get Job Status</ActionButton></Flex>
                </Form></div>)}
                {isStatusLoading && ( <ProgressBar 
                                aria-label="Loading.."
                                isIndeterminate={true}/>) }
            {segmentStatusItem && (<div><br></br><StatusLight variant="positive">{`Status: ${segmentStatusItem.status}`}</StatusLight></div>)}
        </View>
    );
}

SegmentRefresh.propTypes = {
    runtime: PropTypes.any,
    ims: PropTypes.any
}

export default SegmentRefresh

