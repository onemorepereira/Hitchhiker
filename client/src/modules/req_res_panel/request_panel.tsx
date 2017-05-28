import React from 'react';
import { Form, Select, Input, Dropdown, Menu, Button, Tabs, Badge, Modal, TreeSelect, Icon, message } from 'antd';
import { HttpMethod } from '../../common/http_method';
import Editor from '../../components/editor';
import KeyValueList from '../../components/key_value';
import { SelectValue } from 'antd/lib/select';
import { StringUtil } from '../../utils/string_util';
import { DtoRecord } from '../../../../api/interfaces/dto_record';
import { DtoHeader } from '../../../../api/interfaces/dto_header';
import { nameWithTag } from '../../components/name_with_tag/index';
import { normalBadgeStyle } from '../../style/theme';
import { TreeData } from 'antd/lib/tree-select/interface';
import { bodyTypes } from '../../common/body_type';
import { testSnippets } from '../../common/test_snippet';
import './style/index.less';
import { ValidateStatus, KeyValueEditMode, KeyValueEditType, ValidateType } from '../../common/custom_type';
import { reqResUIDefaultValue } from '../../state/ui_state';

const FItem = Form.Item;
const Option = Select.Option;
const DButton = Dropdown.Button as any;
const TabPane = Tabs.TabPane;

const defaultBodyType = 'application/json';
const newRecordFlag = '@new';

interface RequestPanelStateProps {

    isRequesting: boolean;

    activeRecord: DtoRecord;

    style?: any;

    collectionTreeData?: TreeData[];

    activeTabKey: string;

    sendRequest(record: DtoRecord);

    onChanged(record: DtoRecord);

    onResize(height: number);

    save(record: DtoRecord);

    saveAs(record: DtoRecord);

    updateTabRecordId(oldId: string, newId: string);

    selectReqTab(recordId: string, tab: string);
}

interface RequestPanelState {

    nameValidateStatus?: ValidateStatus;

    urlValidateStatus?: ValidateStatus;

    headersEditMode: KeyValueEditMode;

    isSaveDlgOpen: boolean;

    isSaveAsDlgOpen: boolean;

    selectedFolderId?: string;
}

class RequestPanel extends React.Component<RequestPanelStateProps, RequestPanelState> {

    private reqPanel: any;

    constructor(props: RequestPanelStateProps) {
        super(props);
        this.state = {
            headersEditMode: KeyValueEditType.keyValueEdit,
            isSaveDlgOpen: false,
            isSaveAsDlgOpen: false
        };
    }

    public componentWillReceiveProps(nextProps: RequestPanelStateProps) {
        this.setState({
            ...this.state,
            isSaveDlgOpen: false,
            isSaveAsDlgOpen: false,
            record: nextProps.activeRecord,
            nameValidateStatus: nextProps.activeRecord.name.trim() === '' ? ValidateType.warning : undefined
        });
    }

    public componentDidMount() {
        this.onResize();
    }

    public componentDidUpdate(prevProps: RequestPanelStateProps, prevState: RequestPanelState) {
        this.onResize();
    }

    private onResize() {
        if (!this.reqPanel || !this.reqPanel.clientHeight) {
            return;
        }
        this.props.onResize(this.reqPanel.clientHeight);
    }

    private getMethods = (defaultValue?: string) => {
        const value = (defaultValue || HttpMethod.GET).toUpperCase();
        return (
            <Select defaultValue={value} onChange={this.onMethodChanged} style={{ width: 100 }}>
                {
                    Object.keys(HttpMethod).map(k =>
                        <Option key={k} value={k}>{k}</Option>)
                }
            </Select>
        );
    }

    private currentBodyType = () => this.props.activeRecord.bodyType || defaultBodyType;

    private getTabExtraFunc = () => {
        const { activeTabKey } = this.props;
        return (
            activeTabKey === reqResUIDefaultValue.activeReqTab ? (
                <Button className="tab-extra-button" onClick={this.onHeaderModeChanged}>
                    {KeyValueEditType.getReverseMode(this.state.headersEditMode)}
                </Button>
            ) : (
                    activeTabKey === 'body' ? (
                        <Dropdown overlay={this.getBodyTypeMenu()} trigger={['click']} style={{ width: 200 }}>
                            <a className="ant-dropdown-link" href="#">
                                {this.currentBodyType()} <Icon type="down" />
                            </a>
                        </Dropdown>
                    ) : (
                            <Dropdown overlay={this.snippetsMenu} trigger={['click']}>
                                <a className="ant-dropdown-link" href="#">
                                    Snippets <Icon type="down" />
                                </a>
                            </Dropdown>
                        ))
        );
    }

    private onSelectSnippet = (e) => {
        const snippet = testSnippets[e.key];
        const { activeRecord } = this.props;
        const testValue = activeRecord.test && activeRecord.test.length > 0 ? (`${activeRecord.test}\n\n${snippet}`) : snippet;
        this.onRecordChanged({ ...activeRecord, test: testValue });
    }

    private snippetsMenu = (
        <Menu onClick={this.onSelectSnippet}>
            {Object.keys(testSnippets).map(s => <Menu.Item key={s}>{s}</Menu.Item>)}
        </Menu>
    );

    private onBodyTypeChanged = (e) => {
        const { headers } = this.props.activeRecord;
        if (!headers) {
            return;
        }
        const record = { ...this.props.activeRecord };
        record.bodyType = e.key;
        const headerKeys = headers.map(h => h.key ? h.key.toLowerCase() : '');
        const index = headerKeys.indexOf('content-type');
        if (index >= 0) {
            headers[index] = { ...headers[index], value: record.bodyType };
        } else {
            headers.push({ isActive: true, key: 'content-type', value: record.bodyType, id: StringUtil.generateUID() });
        }
        record.headers = headers.filter(header => header.key || header.value);
        this.onRecordChanged(record);
    }

    private getBodyTypeMenu = () => {
        return (
            <Menu onClick={this.onBodyTypeChanged} selectedKeys={[this.currentBodyType()]}>
                {Object.keys(bodyTypes).map(type => <Menu.Item key={type}>{type}</Menu.Item>)}
            </Menu>
        );
    }

    private onHeaderModeChanged = () => {
        this.setState({
            ...this.state,
            headersEditMode: KeyValueEditType.getReverseMode(this.state.headersEditMode)
        });
    }

    private onHeadersChanged = (data: DtoHeader[]) => {
        this.onRecordChanged({ ...this.props.activeRecord, headers: data });
    }

    private onMethodChanged = (selectedValue: SelectValue) => {
        this.onRecordChanged({ ...this.props.activeRecord, method: selectedValue.toString() });
    }

    private onInputChanged = (value: string, type: string) => {
        let record = this.props.activeRecord;
        record[type] = value;

        let nameValidateStatus = this.state.nameValidateStatus;
        if (type === 'name') {
            if ((value as string).trim() === '') {
                nameValidateStatus = ValidateType.warning;
            } else if (this.state.nameValidateStatus) {
                nameValidateStatus = undefined;
            }
        }
        this.onRecordChanged({ ...record });
    }

    private onRecordChanged = (record: DtoRecord) => {
        this.props.onChanged(record);
    }

    private canSave = () => {
        if (this.props.activeRecord.name.trim() !== '') {
            return true;
        }
        message.warning('miss name');
        return false;
    }

    private onSaveAs = (e) => {
        if (this.canSave()) {
            this.setState({ ...this.state, isSaveAsDlgOpen: true });
        }
    }

    private onSave = (e) => {
        if (this.canSave()) {
            const { activeRecord } = this.props;
            if (activeRecord.id.startsWith(newRecordFlag)) {
                this.setState({ ...this.state, isSaveDlgOpen: true });
            } else {
                this.props.save(activeRecord);
            }
        }
    }

    private onSaveNew = (e) => {
        if (!this.state.selectedFolderId) {
            return;
        }
        const record = { ...this.props.activeRecord };
        [record.collectionId, record.pid] = this.state.selectedFolderId.split('::');

        const oldRecordId = record.id;
        if (this.state.isSaveAsDlgOpen) {
            record.id = StringUtil.generateUID();
            this.props.saveAs(record);
            this.setState({ ...this.state, isSaveAsDlgOpen: false });
        } else {
            if (oldRecordId.startsWith(newRecordFlag)) {
                record.id = StringUtil.generateUID();
                this.props.updateTabRecordId(oldRecordId, record.id);
            }
            this.props.save(record);
            this.setState({ ...this.state, isSaveDlgOpen: false });
        }
    }

    private onTabChanged = (key) => {
        this.props.selectReqTab(this.props.activeRecord.id, key);
    }

    private sendRequest = () => {
        this.props.sendRequest(this.props.activeRecord);
    }

    private setReqPanel = (ele: any) => {
        this.reqPanel = ele;
    }

    public render() {
        const menu = (
            <Menu onClick={this.onSaveAs}>
                <Menu.Item key="save_as">Save As</Menu.Item>
            </Menu>
        );

        const { nameValidateStatus, urlValidateStatus, headersEditMode } = this.state;
        const { activeRecord, isRequesting, style } = this.props;

        return (
            <div ref={this.setReqPanel}>
                <Form className="req-panel" style={style}>
                    <FItem
                        className="req-name"
                        style={{ marginBottom: 8 }}
                        hasFeedback={true}
                        validateStatus={nameValidateStatus}
                    >
                        <Input
                            placeholder="please enter name for this request"
                            spellCheck={false}
                            onChange={(e) => this.onInputChanged(e.currentTarget.value, 'name')}
                            value={activeRecord.name} />
                    </FItem>
                    <Form className="url-panel" layout="inline" >
                        <FItem className="req-url" hasFeedback={true} validateStatus={urlValidateStatus}>
                            <Input
                                placeholder="please enter url of this request"
                                size="large"
                                spellCheck={false}
                                onChange={(e) => this.onInputChanged(e.currentTarget.value, 'url')}
                                addonBefore={this.getMethods(activeRecord.method)}
                                value={activeRecord.url} />
                        </FItem>
                        <FItem className="req-send">
                            <Button type="primary" icon="rocket" loading={isRequesting} onClick={this.sendRequest}>
                                Send
                        </Button>
                        </FItem>
                        <FItem className="req-save" style={{ marginRight: 0 }}>
                            <DButton overlay={menu} onClick={this.onSave}>
                                Save
                        </DButton>
                        </FItem>
                    </Form>
                    <div>
                        <Tabs
                            className="req-res-tabs"
                            defaultActiveKey="headers"
                            activeKey={this.props.activeTabKey}
                            animated={false}
                            onChange={this.onTabChanged}
                            tabBarExtraContent={this.getTabExtraFunc()}>
                            <TabPane tab={nameWithTag('Headers', activeRecord.headers ? (Math.max(0, activeRecord.headers.length)).toString() : '')} key="headers">
                                <KeyValueList
                                    mode={headersEditMode}
                                    onHeadersChanged={this.onHeadersChanged}
                                    headers={this.props.activeRecord.headers}
                                />
                            </TabPane>
                            <TabPane tab={(
                                <Badge
                                    style={normalBadgeStyle}
                                    dot={!!activeRecord.body && activeRecord.body.length > 0}
                                    count=""
                                > Body
                                </Badge>
                            )} key="body">
                                <Editor type={bodyTypes[this.currentBodyType()]} fixHeight={true} height={300} value={activeRecord.body} onChange={v => this.onInputChanged(v, 'body')} />
                            </TabPane>
                            <TabPane tab={(
                                <Badge
                                    style={normalBadgeStyle}
                                    dot={!!activeRecord.test && activeRecord.test.length > 0}
                                    count="">
                                    Test
                                </Badge>
                            )} key="test">
                                <Editor type="javascript" height={300} fixHeight={true} value={activeRecord.test} onChange={v => this.onInputChanged(v, 'test')} />
                            </TabPane>
                        </Tabs>
                    </div>
                </Form>
                <Modal
                    title="Save Request"
                    visible={this.state.isSaveDlgOpen || this.state.isSaveAsDlgOpen}
                    okText="OK"
                    cancelText="Cancel"
                    onOk={this.onSaveNew}
                    onCancel={() => this.setState({ ...this.state, isSaveDlgOpen: false, isSaveAsDlgOpen: false })}
                >
                    <div style={{ marginBottom: '8px' }}>Select collection/folder:</div>
                    <TreeSelect
                        allowClear={true}
                        style={{ width: '100%' }}
                        dropdownStyle={{ maxHeight: 500, overflow: 'auto' }}
                        placeholder="Please select collection / folder"
                        treeDefaultExpandAll={true}
                        value={this.state.selectedFolderId}
                        onChange={(e) => this.setState({ ...this.state, selectedFolderId: e })}
                        treeData={this.props.collectionTreeData} />
                </Modal>
            </div>
        );
    }
}

export default RequestPanel;