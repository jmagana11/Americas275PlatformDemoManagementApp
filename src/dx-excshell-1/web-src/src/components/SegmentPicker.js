import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {
    ListBox,
    Item,
    Text,
    ProgressBar
} from '@adobe/react-spectrum'
import Function from '@spectrum-icons/workflow/Function'
import allActions from '../config.json'

function SegmentPicker(props){
    const [secondPickerItems, setSecondPickerItems] = useState([]);
    const [selectedSecondPickerItems, setSelectedSecondPickerItems] = useState(new Set());
    const [isLoading, setIsLoading] = useState(true);

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

    function handleSelection(selection){
        console.log("Selected segments:", selection);
        setSelectedSecondPickerItems(selection);
        // Convert Set to Array for the parent callback
        const selectedIds = Array.from(selection);
        props.parentCallbackSeg(selectedIds);
    }

    useEffect(() => {
        if (!props.sbxContext) {
            return;
        }
        console.log("Fetching segments for sandbox:", props.sbxContext);
        actionHeaders['sandboxName'] = props.sbxContext;
        fetch(allActions.getSegments, fetchConfig)
            .then((response) => response.json())
            .then((data) => {
                console.log("Raw segments data:", data);
                
                // Check if data.segments exists and is an array
                if (!data.segments || !Array.isArray(data.segments)) {
                    console.error("No segments data found or invalid format");
                    setSecondPickerItems([]);
                    setIsLoading(false);
                    return;
                }

                // Log each segment's complete evaluation info for debugging
                data.segments.forEach((segment, index) => {
                    console.log(`Segment ${index} - ${segment.name}:`, {
                        id: segment.id,
                        type: segment.type,
                        evaluationInfo: JSON.stringify(segment.evaluationInfo, null, 2)
                    });
                });

                // Filter for segments that can be refreshed
                const refreshableSegments = data.segments.filter(segment => {
                    // Check if this is a batch segment based on Adobe's requirements
                    const isBatchSegment = segment.type === "SegmentDefinition" && 
                        segment.evaluationInfo && 
                        segment.evaluationInfo.batch && 
                        segment.evaluationInfo.batch.enabled === true;
                    
                    if (isBatchSegment) {
                        console.log("Found batch segment:", {
                            name: segment.name,
                            id: segment.id,
                            evaluationInfo: segment.evaluationInfo
                        });
                    } else {
                        console.log("Skipping non-batch segment:", {
                            name: segment.name,
                            id: segment.id,
                            evaluationInfo: segment.evaluationInfo
                        });
                    }
                    return isBatchSegment;
                });
                
                const options = refreshableSegments.map((item) => ({
                    name: item.name,
                    value: item.id
                }));

                console.log("Final segment options:", options);
                setSecondPickerItems(options);
                setIsLoading(false);
            })
            .catch(error => {
                console.error("Error fetching segments:", error);
                setSecondPickerItems([]);
                setIsLoading(false);
            });

    }, [props.sbxContext]);

    return(
    <>
        {isLoading && (
            <>
                <br></br>
                <ProgressBar isIndeterminate={true}/>
            </>
        )}
        {!isLoading && (
            <>
                <ListBox
                    label="Select Segments to Refresh"
                    items={secondPickerItems}
                    aria-label="Select segments to refresh"
                    selectionMode="multiple"
                    selectedKeys={selectedSecondPickerItems}
                    onSelectionChange={handleSelection}
                    width="100%">
                    {(item) => (
                        <Item key={item.value}>
                            {item.name}
                        </Item>
                    )}
                </ListBox>
                {secondPickerItems.length === 0 && (
                    <Text>No refreshable segments found in this sandbox</Text>
                )}
                {selectedSecondPickerItems.size > 0 && (
                    <Text>Selected {selectedSecondPickerItems.size} segment(s)</Text>
                )}
            </>
        )}
    </>)
}

SegmentPicker.propTypes = {
    ims: PropTypes.any,
    parentCallbackSeg: PropTypes.func,
    sbxContext: PropTypes.string
}

export default SegmentPicker;